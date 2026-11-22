package com.mapit.operations.infrastructure.notification;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;

import org.jspecify.annotations.Nullable;
import org.springframework.dao.DataAccessException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.TransactionException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.mapit.operations.application.notification.*;
import com.mapit.operations.domain.notification.*;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagContext;
import com.mapit.shared.flags.FeatureFlagPort;

/** HTTP propio. JwtAuthenticationFilter/CurrentStaffIdentity de MAP-238 autentican antes de entrar. */
@RestController
@RequestMapping("/api/v1/me/notifications")
public class NotificationController {
    private final CurrentNotificationScope scopes;
    private final MyNotificationPreferences preferences;
    private final tools.jackson.databind.ObjectMapper json;
    private final FeatureFlagPort flags;
    private final NotificationCursorCodec cursors;
    private final ListMyNotifications list;
    private final CountMyUnreadNotifications count;
    private final MarkMyNotificationRead read;
    private final MarkAllMyNotificationsRead readAll;
    public NotificationController(CurrentNotificationScope scopes, FeatureFlagPort flags, NotificationCursorCodec cursors,
            ListMyNotifications list, CountMyUnreadNotifications count, MarkMyNotificationRead read, MarkAllMyNotificationsRead readAll, MyNotificationPreferences preferences, tools.jackson.databind.ObjectMapper json) {
        this.scopes=scopes; this.flags=flags; this.cursors=cursors; this.list=list; this.count=count; this.read=read; this.readAll=readAll; this.preferences=preferences;this.json=json;
    }
    @GetMapping @Transactional(readOnly=true)
    public ResponseEntity<Page> list(HttpServletRequest request) throws IOException {
        validate(request,Set.of("limit","cursor"));
        var scope=authorize(request);
        String size=request.getParameter("limit");
        if(size!=null && !size.matches("[0-9]{1,3}")) throw new IllegalArgumentException();
        int limit=size==null ? 20 : Integer.parseInt(size);
        String cursor=request.getParameter("cursor");
        var result=list.execute(limit,cursor==null ? null : cursors.decode(cursor,scope));
        return ok(new Page(result.content().stream().map(Item::from).toList(),result.hasMore(),result.nextCursor().map(cursors::encode).orElse(null)));
    }
    @GetMapping("/unread-count") @Transactional(readOnly=true)
    public ResponseEntity<UnreadCount> count(HttpServletRequest request) throws IOException {
        validate(request,Set.of()); authorize(request);
        return ok(new UnreadCount(count.execute()));
    }
    @PatchMapping("/{notificationId}/read") @Transactional
    public ResponseEntity<ReadResult> read(HttpServletRequest request, @PathVariable String notificationId) throws IOException {
        validate(request,Set.of()); authorize(request);
        if(!notificationId.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")) throw new IllegalArgumentException();
        var result=read.execute(UUID.fromString(notificationId)).orElseThrow(Hidden::new);
        return ok(new ReadResult(result.id(),java.util.Objects.requireNonNull(result.readAt())));
    }
    @PatchMapping("/read-all") @Transactional
    public ResponseEntity<ReadAllResult> readAll(HttpServletRequest request) throws IOException {
        validate(request,Set.of()); authorize(request);
        return ok(new ReadAllResult(readAll.execute()));
    }
    @GetMapping("/preferences") @Transactional(readOnly=true)
    public ResponseEntity<Preferences> preferences(HttpServletRequest request) throws IOException {
        validate(request,Set.of()); authorize(request); return ok(Preferences.from(preferences.read()));
    }
    @PatchMapping(value="/preferences",consumes="application/json") @Transactional
    public ResponseEntity<Preferences> updatePreferences(HttpServletRequest request) throws IOException {
        // Body se analiza aquí de forma estricta, sin cambiar Jackson global de otros módulos.
        if(!request.getParameterMap().isEmpty() || request.getHeader("X-Tenant-Id")!=null || request.getHeader("X-User-Id")!=null) throw new IllegalArgumentException();
        authorize(request);
        byte[] body=request.getInputStream().readNBytes(1025);
        if(body.length==0 || body.length>1024) throw new IllegalArgumentException();
        tools.jackson.databind.JsonNode node;
        try { node=json.reader().with(tools.jackson.databind.DeserializationFeature.FAIL_ON_READING_DUP_TREE_KEY,tools.jackson.databind.DeserializationFeature.FAIL_ON_TRAILING_TOKENS).readTree(body); } catch(RuntimeException malformed) { throw new IllegalArgumentException(); }
        if(node==null || !node.isObject() || node.isEmpty()) throw new IllegalArgumentException();
        var changes=new java.util.EnumMap<NotificationCategory,Boolean>(NotificationCategory.class);
        for(var property:node.properties()) {
            var category=switch(property.getKey()) {
                case "reservations" -> NotificationCategory.RESERVATIONS;
                case "operations" -> NotificationCategory.OPERATIONS;
                default -> throw new IllegalArgumentException();
            };
            if(!property.getValue().isBoolean()) throw new IllegalArgumentException();
            changes.put(category,property.getValue().booleanValue());
        }
        return ok(Preferences.from(preferences.patch(changes)));
    }
    public record Preferences(boolean reservations,boolean operations) {
        static Preferences from(java.util.Map<NotificationCategory,Boolean> values) { return new Preferences(values.get(NotificationCategory.RESERVATIONS),values.get(NotificationCategory.OPERATIONS)); }
    }
    private NotificationScope authorize(HttpServletRequest request) {
        var scope=scopes.require(); // Cuenta/tenant y concesiones antes del toggle.
        String token=request.getHeader("Authorization");
        if(token==null || !token.startsWith("Bearer ")) throw new NotificationAuthenticationRequiredException();
        String session;
        try { session=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(("notification-session-v1:"+token).getBytes(StandardCharsets.UTF_8))); }
        catch(java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(); }
        boolean enabled;
        try { enabled=flags.isEnabledFor(FeatureFlag.MAPIT_S6_NOTIFICATION_CENTER,new FeatureFlagContext(scope.recipient().tenantId(),scope.recipient().userId(),session)); }
        catch(RuntimeException unavailable) { enabled=false; }
        if(!enabled) throw new Hidden();
        return scope;
    }
    private void validate(HttpServletRequest request, Set<String> allowed) throws IOException {
        if(request.getParameterMap().entrySet().stream().anyMatch(e->!allowed.contains(e.getKey()) || e.getValue().length!=1)
                || request.getHeader("X-Tenant-Id")!=null || request.getHeader("X-User-Id")!=null
                || request.getInputStream().read()!=-1) throw new IllegalArgumentException();
    }
    private static <T> ResponseEntity<T> ok(T value) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value); }
    private static class Hidden extends RuntimeException {}
    @ExceptionHandler(NotificationAuthenticationRequiredException.class)
    ResponseEntity<ProblemDetail> unauthenticated() { return problem(HttpStatus.UNAUTHORIZED,"notification-unauthorized"); }
    @ExceptionHandler(NotificationAccessDeniedException.class)
    ResponseEntity<ProblemDetail> forbidden() { return problem(HttpStatus.FORBIDDEN,"notification-forbidden"); }
    @ExceptionHandler(Hidden.class)
    ResponseEntity<ProblemDetail> hidden() { return problem(HttpStatus.NOT_FOUND,"notification-not-found"); }
    @ExceptionHandler({IllegalArgumentException.class, IOException.class})
    ResponseEntity<ProblemDetail> invalid() { return problem(HttpStatus.BAD_REQUEST,"notification-invalid-request"); }
    @ExceptionHandler({DataAccessException.class,TransactionException.class})
    ResponseEntity<ProblemDetail> unavailable() { return problem(HttpStatus.SERVICE_UNAVAILABLE,"notification-unavailable"); }
    @ExceptionHandler(RuntimeException.class)
    ResponseEntity<ProblemDetail> unexpected() { return problem(HttpStatus.INTERNAL_SERVER_ERROR,"notification-failure"); }
    private static ResponseEntity<ProblemDetail> problem(HttpStatus status,String code) {
        var problem=ProblemDetail.forStatusAndDetail(status,"No se pudo completar la operación de notificaciones.");
        problem.setType(URI.create("https://mapit.local/problems/"+code));
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(problem);
    }
    public record Page(List<Item> content,boolean hasMore,@JsonInclude(JsonInclude.Include.NON_NULL) @Nullable String nextCursor) {}
    public record Item(UUID id,NotificationType type,NotificationCategory category,UUID establishmentId,UUID reservationId,
            Instant occurredAt,Instant createdAt,@JsonInclude(JsonInclude.Include.ALWAYS) @Nullable Instant readAt) {
        static Item from(Notification n) { var event=n.event(); return new Item(n.id(),event.type(),n.category(),event.establishmentId(),event.reservationId(),event.occurredAt(),n.createdAt(),n.readAt()); }
    }
    public record UnreadCount(long unreadCount) {}
    public record ReadResult(UUID id,Instant readAt) {}
    public record ReadAllResult(long updatedCount) {}
}
