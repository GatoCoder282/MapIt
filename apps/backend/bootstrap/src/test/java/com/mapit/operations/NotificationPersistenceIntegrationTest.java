package com.mapit.operations;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.identity.domain.*;
import com.mapit.operations.domain.notification.*;
import com.mapit.operations.infrastructure.notification.JdbcNotificationRepository;
import com.mapit.shared.flags.*;
import com.mapit.shared.tenant.*;

import tools.jackson.databind.ObjectMapper;

/** HTTP real y mapit_app sin bypass; únicamente BD efímera, nunca datos Docker existentes. */
@Tag("integration") @Testcontainers
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
class NotificationPersistenceIntegrationTest {
    @Container static final PostgreSQLContainer<?> DB=new PostgreSQLContainer<>("postgres:17-alpine").withDatabaseName("notification_it").withUsername("mapit").withPassword("test-owner");
    static final UUID A=id(1), B=id(2), C=id(3), M=id(4), SUPER=id(5), E=id(10), E2=id(11), F=id(12), R=id(20), R2=id(21), RF=id(22);
    @DynamicPropertySource static void properties(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url",DB::getJdbcUrl); p.add("spring.datasource.username",()->"mapit_app"); p.add("spring.datasource.password",()->"test-runtime");
        p.add("spring.flyway.url",DB::getJdbcUrl); p.add("spring.flyway.user",DB::getUsername); p.add("spring.flyway.password",DB::getPassword);
        p.add("spring.flyway.placeholders.mapitAppDbPassword",()->"test-runtime");
        String compatibility=System.getenv("MAPIT_TEST_COMPAT_MIGRATIONS");
        if(compatibility!=null) p.add("spring.flyway.locations",()->"classpath:db/migration,filesystem:"+compatibility.replace('\\','/'));
        p.add("mapit.jwt.secret",()->"notification-integration-test-secret-0123456789");
        p.add("mapit.unleash.enabled",()->"false"); p.add("mapit.notifications.cleanup-enabled",()->"false");
        p.add("mapit.realtime.outbox.poll-interval-ms",()->"3600000");
        p.add("mapit.notifications.delivery-interval-ms",()->"3600000");
    }
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactions;
    @Autowired JdbcNotificationRepository repository;
    @Autowired NotificationAuthorizationPort authorization;
    @Autowired AccessTokenIssuer tokens;
    @Autowired com.mapit.shared.notification.ReservationNotificationEvents events;
    @Autowired com.mapit.operations.infrastructure.notification.NotificationDeliveryWorker worker;
    @Autowired com.mapit.config.PaymentOutboxPublisher arrivals;
    @org.springframework.test.context.bean.override.mockito.MockitoSpyBean NotificationInvalidationPublisher signals;
    @Autowired ObjectMapper json;
    @Autowired org.springframework.messaging.simp.user.SimpUserRegistry registry;
    @MockitoBean FeatureFlagPort flags;
    private JdbcTemplate owner;
    private TransactionTemplate tx;
    private Instant now;

    @BeforeEach void seed() {
        owner=new JdbcTemplate(new DriverManagerDataSource(DB.getJdbcUrl(),DB.getUsername(),DB.getPassword()));
        tx=new TransactionTemplate(transactions); now=Instant.now().minusSeconds(10).truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        when(flags.isEnabledFor(eq(FeatureFlag.MAPIT_S6_NOTIFICATION_CENTER),any(FeatureFlagContext.class))).thenReturn(true);
        when(flags.isEnabled(eq(FeatureFlag.REALTIME_WEBSOCKET),anyBoolean())).thenReturn(true);
        owner.update("delete from notification_event_candidate"); owner.update("delete from notification_event_outbox"); owner.update("delete from notification_preference");
        owner.update("delete from realtime_event_outbox where tenant_id in ('notify-it-a','notify-it-b')");
        owner.update("delete from notification"); owner.update("delete from notification_delivery_key");
        owner.update("insert into tenant(id,name,slug,vertical) values ('notify-it-a','A','notify-it-a','RESTAURANT'),('notify-it-b','B','notify-it-b','RESTAURANT') on conflict(id) do update set status='ACTIVE'");
        owner.update("update app_user set active=false where email='late@notify.test'");
        for(UUID user:List.of(A,B,C,M,SUPER)) {
            String tenant=user.equals(C)?"notify-it-b":user.equals(SUPER)?"platform":"notify-it-a";
            String role=user.equals(B)?"STAFF":user.equals(M)?"MANAGER":user.equals(SUPER)?"SUPER_ADMIN":"ADMIN";
            owner.update("insert into app_user(id,tenant_id,email,password_hash,full_name,role) values (?,?,?,'not-a-login-hash','Notification Test',?) on conflict(id) do update set active=true,role=excluded.role,staff_tokens_valid_after=null",user,tenant,user+"@notify.test",role);
        }
        for(UUID venue:List.of(E,E2,F)) {
            String tenant=venue.equals(F)?"notify-it-b":"notify-it-a";
            owner.update("insert into establishment(id,tenant_id,name,slug,type) values (?,?,'Test',?,'RESTAURANT') on conflict(id) do update set deleted_at=null",venue,tenant,venue.toString());
        }
        for(UUID reservation:List.of(R,R2,RF)) {
            String tenant=reservation.equals(RF)?"notify-it-b":"notify-it-a";
            UUID person=reservation.equals(RF)?id(31):id(30), venue=reservation.equals(RF)?F:reservation.equals(R2)?E2:E;
            owner.update("insert into person(id,tenant_id,full_name) values (?,?,'Test Guest') on conflict(id) do nothing",person,tenant);
            owner.update("insert into reservation(id,tenant_id,establishment_id,person_id,starts_at,ends_at,created_by) values (?,?,?,?,now()+interval '1 day',now()+interval '25 hours',?) on conflict(id) do nothing",reservation,tenant,venue,person,reservation.equals(RF)?C:A);
        }
        owner.update("delete from establishment_staff_access where user_id=?",B);
        grant(E);
    }
    @Test void flyway41PreservesRlsAndAllowsRealV40WhenProvided() {
        assertThat(owner.queryForObject("select count(*) from flyway_schema_history where version='41' and success",Integer.class)).isEqualTo(1);
        if(System.getenv("MAPIT_TEST_COMPAT_MIGRATIONS")!=null) assertThat(owner.queryForObject("select count(*) from flyway_schema_history where version='40' and success",Integer.class)).isEqualTo(1);
        create(notice(40,A,E,R)); create(notice(41,B,E,R)); create(notice(42,C,F,RF));
        assertThat(owner.queryForObject("select count(*) from pg_class where relname in ('notification','notification_delivery_key') and relrowsecurity and relforcerowsecurity",Integer.class)).isEqualTo(2);
        tx.executeWithoutResult(s->{
            assertThat(jdbc.queryForObject("select current_user",String.class)).isEqualTo("mapit_app");
            assertThat(jdbc.queryForObject("select rolsuper or rolbypassrls from pg_roles where rolname=current_user",Boolean.class)).isFalse();
            jdbc.queryForObject(TenantScope.SET_LOCAL_SQL,String.class,"");
            assertThat(jdbc.queryForObject("select count(*) from notification",Integer.class)).isZero();
            assertThat(jdbc.queryForObject("select count(*) from notification_delivery_key",Integer.class)).isZero();
            jdbc.queryForObject(TenantScope.SET_LOCAL_SQL,String.class,"notify-it-a");
            assertThat(jdbc.queryForObject("select count(*) from notification",Integer.class)).isEqualTo(2);
            assertThat(jdbc.queryForObject("select count(*) from notification_delivery_key",Integer.class)).isEqualTo(2);
            assertThat(jdbc.update("update notification set read_at=statement_timestamp() where id=?",id(42))).isZero();
            jdbc.queryForObject(TenantScope.SET_LOCAL_SQL,String.class,"notify-it-b");
            assertThat(jdbc.queryForObject("select count(*) from notification",Integer.class)).isEqualTo(1);
            assertThat(jdbc.queryForObject("select count(*) from notification_delivery_key",Integer.class)).isEqualTo(1);
        });
    }
    @Test void httpListsCountsAndMarksOnlyOwnUserAndTenantWithRequiredNulls() {
        create(notice(40,A,E,R)); create(notice(41,A,E,R)); create(notice(42,B,E,R)); create(notice(43,C,F,RF));
        var first=api().get().uri("/me/notifications?limit=1").header("Authorization",bearer(A)).exchange().expectStatus().isOk()
                .expectHeader().valueEquals("Cache-Control","no-store").expectBody(String.class).returnResult().getResponseBody();
        var page=json.readTree(first); assertThat(page.get("content").get(0).has("readAt")).isTrue();
        assertThat(page.get("content").get(0).get("readAt").isNull()).isTrue();
        assertThat(page.get("content").get(0).has("recipientUserId")).isFalse();
        String cursor=page.get("nextCursor").asString();
        api().get().uri("/me/notifications?limit=1&cursor="+cursor).header("Authorization",bearer(A)).exchange().expectStatus().isOk().expectBody().jsonPath("$.content[0].id").isEqualTo(id(40).toString()).jsonPath("$.hasMore").isEqualTo(false).jsonPath("$.nextCursor").doesNotExist();
        api().get().uri("/me/notifications/unread-count").header("Authorization",bearer(A)).exchange().expectBody().jsonPath("$.unreadCount").isEqualTo(2);
        read(A,id(42)).expectStatus().isNotFound(); read(A,id(43)).expectStatus().isNotFound(); read(A,id(999)).expectStatus().isNotFound();
        var one=read(A,id(41)).expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody();
        var two=read(A,id(41)).expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody(); assertThat(two).isEqualTo(one);
        api().patch().uri("/me/notifications/read-all").header("Authorization",bearer(A)).exchange().expectStatus().isOk().expectBody().jsonPath("$.updatedCount").isEqualTo(1);
        api().patch().uri("/me/notifications/read-all").header("Authorization",bearer(A)).exchange().expectBody().jsonPath("$.updatedCount").isEqualTo(0);
        api().get().uri("/me/notifications/unread-count").header("Authorization",bearer(B)).exchange().expectBody().jsonPath("$.unreadCount").isEqualTo(1);
    }
    @Test void rejectsBodiesSelectorsMalformedCursorsAndPrivilegedHeadersWithoutWrites() {
        create(notice(40,A,E,R));
        for(String query:List.of("?userId="+B,"?tenantId=notify-it-b","?establishmentId="+F,"?limit=0","?limit=101","?limit=1&limit=2","?cursor=private-canary","?cursor="))
            api().get().uri("/me/notifications"+query).header("Authorization",bearer(A)).exchange().expectStatus().isBadRequest().expectHeader().valueEquals("Cache-Control","no-store");
        api().patch().uri("/me/notifications/read-all").header("Authorization",bearer(A)).contentType(MediaType.APPLICATION_JSON).body(Map.of("userId",B)).exchange().expectStatus().isBadRequest();
        api().get().uri("/me/notifications").header("Authorization",bearer(A)).header("X-Tenant-Id","notify-it-b").exchange().expectStatus().isBadRequest();
        assertThat(tx.<Long>execute(s->repository.countUnread(scope(A)))).isEqualTo(1L);
    }
    @Test void featureOffProviderFailureAndMissingJwtNeverGrantAccessAndDoNotBlockCreation() {
        when(flags.isEnabledFor(eq(FeatureFlag.MAPIT_S6_NOTIFICATION_CENTER),any(FeatureFlagContext.class))).thenReturn(false);
        create(notice(40,A,E,R));
        api().get().uri("/me/notifications").exchange().expectStatus().isUnauthorized();
        api().get().uri("/me/notifications").header("Authorization",bearer(A)).exchange().expectStatus().isNotFound();
        api().patch().uri("/me/notifications/"+id(40)+"/read").header("Authorization",bearer(A)).exchange().expectStatus().isNotFound();
        doThrow(new IllegalStateException("private-provider-canary")).when(flags).isEnabledFor(eq(FeatureFlag.MAPIT_S6_NOTIFICATION_CENTER),any(FeatureFlagContext.class));
        api().get().uri("/me/notifications").header("Authorization",bearer(A)).exchange().expectStatus().isNotFound();
        assertThat(tx.<Long>execute(s->repository.countUnread(scope(A)))).isEqualTo(1L);
        doReturn(true).when(flags).isEnabledFor(eq(FeatureFlag.MAPIT_S6_NOTIFICATION_CENTER),any(FeatureFlagContext.class));
        api().get().uri("/me/notifications/unread-count").header("Authorization",bearer(A)).exchange().expectStatus().isOk().expectBody().jsonPath("$.unreadCount").isEqualTo(1);
        var contexts=org.mockito.ArgumentCaptor.forClass(FeatureFlagContext.class);
        verify(flags,atLeastOnce()).isEnabledFor(eq(FeatureFlag.MAPIT_S6_NOTIFICATION_CENTER),contexts.capture());
        assertThat(contexts.getAllValues()).allSatisfy(context->{
            assertThat(context.tenantId()).isEqualTo(TenantId.of("notify-it-a"));
            assertThat(context.userId()).isEqualTo(A);
            assertThat(context.sessionId()).matches("[0-9a-f]{64}");
        });
    }
    @Test void revocationRolesTenantStatusAndEstablishmentPermissionsAreCurrent() {
        create(notice(40,B,E,R));
        String old=bearer(B); owner.update("update app_user set staff_tokens_valid_after=now()+interval '1 second' where id=?",B);
        api().get().uri("/me/notifications").header("Authorization",old).exchange().expectStatus().isUnauthorized();
        owner.update("update app_user set staff_tokens_valid_after=null where id=?",B);
        var stale=tx.execute(s->scope(B)); owner.update("delete from establishment_staff_access where user_id=?",B);
        assertThat(tx.<Long>execute(s->repository.countUnread(stale))).isZero();
        read(B,id(40)).expectStatus().isNotFound();
        api().get().uri("/me/notifications").header("Authorization",bearer(SUPER)).exchange().expectStatus().isOk().expectBody().jsonPath("$.content.length()").isEqualTo(0);
        assertThat(tx.<Set<UUID>>execute(s->scope(M).establishmentsByType().get(NotificationType.RESERVATION_CHECKED_IN))).contains(E,E2);
        owner.update("update tenant set status='SUSPENDED' where id='notify-it-b'");
        api().get().uri("/me/notifications").header("Authorization",bearer(C)).exchange().expectStatus().isUnauthorized();
    }
    @Test void cursorCannotCrossUserOrSurviveGrantRevocation() {
        grant(E2); create(notice(40,B,E,R)); create(notice(41,B,E2,R2));
        String body=api().get().uri("/me/notifications?limit=1").header("Authorization",bearer(B)).exchange().expectBody(String.class).returnResult().getResponseBody();
        String cursor=json.readTree(body).get("nextCursor").asString();
        api().get().uri("/me/notifications?cursor="+cursor).header("Authorization",bearer(A)).exchange().expectStatus().isBadRequest();
        owner.update("delete from establishment_staff_access where user_id=? and establishment_id=?",B,E2);
        api().get().uri("/me/notifications?cursor="+cursor).header("Authorization",bearer(B)).exchange().expectStatus().isBadRequest();
    }
    @Test void dedupIsConcurrentPreservesReadAndRejectsIncompatibleEvent() throws Exception {
        var original=notice(40,A,E,R); var latch=new CountDownLatch(1);
        try(var threads=Executors.newVirtualThreadPerTaskExecutor()) {
            var futures=new ArrayList<Future<Notification>>();
            for(int i=0;i<2;i++) { int index=i; futures.add(threads.submit(()->{latch.await(); return create(new Notification(id(40+index),original.recipient(),original.event(),now.plusSeconds(index),null));})); }
            latch.countDown(); var first=futures.get(0).get(10,TimeUnit.SECONDS); var second=futures.get(1).get(10,TimeUnit.SECONDS); assertThat(first).isEqualTo(second);
            var read=tx.execute(s->repository.markRead(scope(A),first.id(),now.plusSeconds(5)).orElseThrow());
            assertThat(create(original)).isEqualTo(read);
        }
        var changed=new NotificationEvent(original.event().id(),original.event().tenantId(),original.event().type(),original.event().occurredAt(),E2,R2);
        assertThatThrownBy(()->create(new Notification(id(50),original.recipient(),changed,now,null))).isInstanceOf(NotificationDeliveryConflictException.class);
        assertThat(owner.queryForObject("select count(*) from notification",Integer.class)).isEqualTo(1);
    }
    @Test void expiryAndPurgeKeepDedupeKeyAndNeverRecreateDelivery() {
        var value=notice(40,A,E,R); create(value);
        owner.update("update notification set expires_at=now()-interval '1 second' where id=?",value.id());
        assertThat(tx.<Long>execute(s->repository.countUnread(scope(A)))).isZero();
        assertThat(tx.<Integer>execute(s->repository.purgeExpired(TenantId.of("notify-it-a"),100))).isEqualTo(1);
        assertThat(owner.queryForObject("select count(*) from notification_delivery_key",Integer.class)).isEqualTo(1);
        assertThatThrownBy(()->create(value)).isInstanceOf(NotificationExpiredException.class);
        assertThat(owner.queryForObject("select count(*) from notification",Integer.class)).isZero();
    }
    @Test void bulkUsesServerCutoffAndRollbackDoesNotPartiallyMark() {
        create(notice(40,A,E,R)); var future=notice(41,A,E,R); future=new Notification(future.id(),future.recipient(),future.event(),now.plusSeconds(60),null); create(future);
        assertThatThrownBy(()->tx.executeWithoutResult(s->{repository.markAllRead(scope(A),now.plusSeconds(1));throw new IllegalStateException("rollback");})).isInstanceOf(IllegalStateException.class);
        assertThat(tx.<Long>execute(s->repository.countUnread(scope(A)))).isEqualTo(2L);
        assertThat(tx.<Long>execute(s->repository.markAllRead(scope(A),now.plusSeconds(1)))).isEqualTo(1L);
        assertThat(tx.<Long>execute(s->repository.countUnread(scope(A)))).isEqualTo(1L);
    }
    @Test void invalidForeignKeyRollsBackDeliveryKeyAndPayloadTogether() {
        assertThatThrownBy(()->create(notice(40,A,E,RF))).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(owner.queryForObject("select count(*) from notification_delivery_key",Integer.class)).isZero();
        assertThat(owner.queryForObject("select count(*) from notification",Integer.class)).isZero();
    }

    @Test void capturesOriginalCandidatesRevalidatesAndConsumesWithoutFlagOrBroker() {
        var tenant=TenantId.of("notify-it-a"); UUID event=id(800);
        when(flags.isEnabledFor(eq(FeatureFlag.MAPIT_S6_NOTIFICATION_CENTER),any(FeatureFlagContext.class))).thenReturn(false);
        tx.executeWithoutResult(s->events.record(event,tenant,"RESERVATION_CREATED",now,E,R));
        // Nuevo administrador NO es candidato histórico. STAFF que pierde concesión se excluye.
        UUID late=id(901);
        owner.update("insert into app_user(id,tenant_id,email,password_hash,full_name,role) values (?,'notify-it-a','late@notify.test','test','Late','ADMIN') on conflict(id) do update set active=true",late);
        owner.update("delete from establishment_staff_access where user_id=?",B);
        tx.executeWithoutResult(s->{ worker.fanout(tenant); events.record(event,tenant,"RESERVATION_CREATED",now,E,R); worker.fanout(tenant); });
        assertThat(owner.queryForList("select recipient_user_id from notification where source_event_id=?",UUID.class,event)).containsExactlyInAnyOrder(A,M);
        assertThat(owner.queryForObject("select count(*) from notification_event_outbox where processed_at is not null",Integer.class)).isEqualTo(1);
        owner.update("update app_user set active=false where id=?",late);
    }
    @Test void arrivalReusesActualBusinessEventAndRollbackLeavesNoFactsOrCandidates() {
        var tenant=TenantId.of("notify-it-a");
        assertThatThrownBy(()->tx.executeWithoutResult(s->{events.record(id(801),tenant,"RESERVATION_CREATED",now,E,R);throw new IllegalStateException();})).isInstanceOf(IllegalStateException.class);
        assertThat(owner.queryForObject("select count(*) from notification_event_outbox",Integer.class)).isZero();
        assertThat(owner.queryForObject("select count(*) from notification_event_candidate",Integer.class)).isZero();
        tx.executeWithoutResult(s->arrivals.publishArrival(tenant,E,R,id(999)));
        UUID event=owner.queryForObject("select event_id from realtime_event_outbox where tenant_id='notify-it-a' and event_type='reservation.checked_in'",UUID.class);
        assertThat(owner.queryForObject("select id from notification_event_outbox where event_type='RESERVATION_CHECKED_IN'",UUID.class)).isEqualTo(event);
        tx.executeWithoutResult(s->worker.fanout(tenant));
        assertThat(owner.queryForObject("select count(*) from notification where source_event_id=?",Integer.class,event)).isEqualTo(3);
    }
    @Test void preferencesAreAtomicPrivateAndCannotDisableSecurityOrAcceptUnknownData() {
        api().get().uri("/me/notifications/preferences").header("Authorization",bearer(A)).exchange().expectStatus().isOk().expectBody().jsonPath("$.reservations").isEqualTo(true);
        patchPreferences(A,"{\"reservations\":false}").expectStatus().isOk().expectHeader().valueEquals("Cache-Control","no-store").expectBody().jsonPath("$.operations").isEqualTo(true);
        for(String invalid:List.of("{}"," ","false","null","[]","{\"reservations\":null}","{\"operations\":1}","{\"reservations\":true,\"security\":false}","{\"reservations\":true,\"userId\":\"other\"}","{\"operations\":true,\"operations\":false}","{\"operations\":true}{}")) patchPreferences(A,invalid).expectStatus().isBadRequest();
        api().get().uri("/me/notifications/preferences").header("Authorization",bearer(A)).exchange().expectBody().jsonPath("$.reservations").isEqualTo(false);
        api().get().uri("/me/notifications/preferences").header("Authorization",bearer(B)).exchange().expectBody().jsonPath("$.reservations").isEqualTo(true);
        patchPreferences(C,"{\"operations\":false}").expectStatus().isOk();
        tx.executeWithoutResult(s->{
            jdbc.queryForObject(TenantScope.SET_LOCAL_SQL,String.class,"notify-it-a");
            assertThat(jdbc.queryForObject("select count(*) from notification_preference",Integer.class)).isEqualTo(1);
            jdbc.queryForObject(TenantScope.SET_LOCAL_SQL,String.class,"");
            for(String table:List.of("notification_preference","notification_event_outbox","notification_event_candidate")) assertThat(jdbc.queryForObject("select count(*) from "+table,Integer.class)).isZero();
        });
    }
    @Test void preferencesSuppressOnlyFutureOptionalNoticesWithoutChangingBusinessFacts() {
        create(notice(40,A,E,R));
        patchPreferences(A,"{\"reservations\":false}").expectStatus().isOk();
        var tenant=TenantId.of("notify-it-a");
        tx.executeWithoutResult(s->{ events.record(id(802),tenant,"RESERVATION_CREATED",now,E,R); worker.fanout(tenant); });
        assertThat(owner.queryForObject("select count(*) from notification where recipient_user_id=?",Integer.class,A)).isEqualTo(1);
        patchPreferences(A,"{\"reservations\":true}").expectStatus().isOk();
        tx.executeWithoutResult(s->{ worker.fanout(tenant); events.record(id(803),tenant,"RESERVATION_CREATED",now,E,R); worker.fanout(tenant); });
        assertThat(owner.queryForObject("select count(*) from notification where recipient_user_id=?",Integer.class,A)).isEqualTo(2);
        assertThat(owner.queryForObject("select count(*) from notification_event_outbox where processed_at is not null",Integer.class)).isEqualTo(2);
    }
    @Test void durableSignalsRetryTheSameIdAndReadingCreatesANewVersion() {
        create(notice(40,A,E,R)); var tenant=TenantId.of("notify-it-a");
        doThrow(new IllegalStateException("broker down")).when(signals).publish(any());
        assertThatThrownBy(()->tx.executeWithoutResult(s->worker.signal(tenant))).isInstanceOf(IllegalStateException.class);
        assertThat(owner.queryForObject("select delivered_version from notification where id=?",Long.class,id(40))).isZero();
        doCallRealMethod().when(signals).publish(any());
        tx.executeWithoutResult(s->worker.signal(tenant));
        var captured=org.mockito.ArgumentCaptor.forClass(NotificationInvalidation.class);
        verify(signals,times(2)).publish(captured.capture());
        assertThat(captured.getAllValues().get(0).eventId()).isEqualTo(captured.getAllValues().get(1).eventId());
        tx.executeWithoutResult(s->{repository.markRead(scope(A),id(40),Instant.now());});
        tx.executeWithoutResult(s->worker.signal(tenant));
        assertThat(owner.queryForObject("select delivered_version from notification where id=?",Long.class,id(40))).isEqualTo(2);
    }
    @Test void actualPrivateStompDeliversOnlyToOwnTenantAndStopsAfterTokenRevocation() throws Exception {
        var client=new org.springframework.web.socket.messaging.WebSocketStompClient(new org.springframework.web.socket.client.standard.StandardWebSocketClient());
        client.setMessageConverter(new org.springframework.messaging.converter.SimpleMessageConverter());
        client.setDefaultHeartbeat(new long[]{0,0});
        var inboxA=new LinkedBlockingQueue<String>(); var inboxB=new LinkedBlockingQueue<String>(); var inboxC=new LinkedBlockingQueue<String>();
        org.springframework.messaging.simp.stomp.StompSession one=null,two=null,other=null;
        try {
            one=connect(client,A,inboxA); two=connect(client,B,inboxB); other=connect(client,C,inboxC);
            // El simple broker no soporta receipts de SUBSCRIBE; espera acotada solo en este test.
            Thread.sleep(250);
            assertThat(registry.getUser("staff:notify-it-a:"+A)).as("principal privado en registro STOMP: %s",registry.getUsers()).isNotNull();
            create(notice(40,A,E,R)); tx.executeWithoutResult(s->worker.signal(TenantId.of("notify-it-a")));
            String body=inboxA.poll(5,TimeUnit.SECONDS); assertThat(body).isNotNull();
            assertThat(json.readTree(body).get("eventType").asString()).isEqualTo("notification.inbox.invalidated.v1");
            assertThat(inboxB.poll(200,TimeUnit.MILLISECONDS)).isNull(); assertThat(inboxC.poll(200,TimeUnit.MILLISECONDS)).isNull();
            owner.update("update app_user set staff_tokens_valid_after=now()+interval '1 second' where id=?",A);
            signals.publish(new NotificationInvalidation(id(999),recipient(A),Instant.now()));
            assertThat(inboxA.poll(300,TimeUnit.MILLISECONDS)).isNull();
        } finally {
            for(var session:Arrays.asList(one,two,other)) if(session!=null && session.isConnected()) session.disconnect();
            client.stop();
        }
    }
    private org.springframework.messaging.simp.stomp.StompSession connect(org.springframework.web.socket.messaging.WebSocketStompClient client,UUID user,BlockingQueue<String> inbox) throws Exception {
        var headers=new org.springframework.messaging.simp.stomp.StompHeaders();headers.add("Authorization",bearer(user));
        var session=client.connectAsync(java.net.URI.create("ws://localhost:"+port+"/ws"),new org.springframework.web.socket.WebSocketHttpHeaders(),headers,new org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter(){}).get(10,TimeUnit.SECONDS);
        session.subscribe("/user/topic/notifications",new org.springframework.messaging.simp.stomp.StompFrameHandler(){
            public java.lang.reflect.Type getPayloadType(org.springframework.messaging.simp.stomp.StompHeaders ignored){return byte[].class;}
            public void handleFrame(org.springframework.messaging.simp.stomp.StompHeaders ignored,Object body){inbox.add(new String((byte[])body,java.nio.charset.StandardCharsets.UTF_8));}
        });return session;
    }
    @Test void outboxCandidatesAndPreferencesUseRealRlsWithoutClientScope() {
        var tenant=TenantId.of("notify-it-a");
        tx.executeWithoutResult(s->{events.record(id(804),tenant,"RESERVATION_CREATED",now,E,R);events.record(id(805),TenantId.of("notify-it-b"),"RESERVATION_CREATED",now,F,RF);});
        tx.executeWithoutResult(s->{
            jdbc.queryForObject(TenantScope.SET_LOCAL_SQL,String.class,"notify-it-a");
            assertThat(jdbc.queryForObject("select count(*) from notification_event_outbox",Integer.class)).isEqualTo(1);
            assertThat(jdbc.queryForObject("select count(*) from notification_event_candidate",Integer.class)).isEqualTo(3);
            jdbc.queryForObject(TenantScope.SET_LOCAL_SQL,String.class,"notify-it-b");
            assertThat(jdbc.queryForObject("select count(*) from notification_event_candidate",Integer.class)).isEqualTo(1);
            jdbc.queryForObject(TenantScope.SET_LOCAL_SQL,String.class,"");
            assertThat(jdbc.queryForObject("select count(*) from notification_event_outbox",Integer.class)).isZero();
        });
        assertThatThrownBy(()->tx.executeWithoutResult(s->{
            jdbc.queryForObject(TenantScope.SET_LOCAL_SQL,String.class,"notify-it-a");
            jdbc.update("insert into notification_event_candidate(tenant_id,event_id,user_id) values ('notify-it-b',?,?)",id(805),C);
        })).isInstanceOf(org.springframework.dao.DataAccessException.class).satisfies(error->assertThat(((java.sql.SQLException)error.getCause()).getSQLState()).isEqualTo("42501"));
    }
    private RestTestClient.ResponseSpec patchPreferences(UUID user,String body) { return api().patch().uri("/me/notifications/preferences").header("Authorization",bearer(user)).contentType(MediaType.APPLICATION_JSON).body(body).exchange(); }

    private Notification create(Notification n) { return tx.execute(s->repository.createIfAbsent(n)); }
    private NotificationScope scope(UUID user) { return authorization.resolve(recipient(user)).orElseThrow(); }
    private NotificationRecipient recipient(UUID user) { return new NotificationRecipient(TenantId.of(user.equals(C)?"notify-it-b":user.equals(SUPER)?"platform":"notify-it-a"),user); }
    private Notification notice(long number,UUID user,UUID venue,UUID reservation) { var r=recipient(user); return Notification.unread(id(number),r,new NotificationEvent(id(number+1000),r.tenantId(),NotificationType.RESERVATION_CREATED,now.minusSeconds(1),venue,reservation),now); }
    private void grant(UUID venue) { owner.update("insert into establishment_staff_access(tenant_id,establishment_id,user_id,can_check_in,updated_at,updated_by) values ('notify-it-a',?,?,true,now(),?)",venue,B,A); }
    private String bearer(UUID user) { var r=recipient(user); return "Bearer "+tokens.issue(new AuthenticatedUser(user,r.tenantId(),user+"@notify.test","Notification Test",user.equals(B)?UserRole.STAFF:user.equals(M)?UserRole.MANAGER:user.equals(SUPER)?UserRole.SUPER_ADMIN:UserRole.ADMIN)).value(); }
    private RestTestClient api() { return RestTestClient.bindToServer().baseUrl("http://localhost:"+port+"/api/v1").build(); }
    private RestTestClient.ResponseSpec read(UUID user,UUID notification) { return api().patch().uri("/me/notifications/"+notification+"/read").header("Authorization",bearer(user)).exchange(); }
    private static UUID id(long number) { return new UUID(0,number); }
}
