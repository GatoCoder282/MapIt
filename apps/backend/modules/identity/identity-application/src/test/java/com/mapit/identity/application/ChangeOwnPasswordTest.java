package com.mapit.identity.application;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.identity.domain.*;
import com.mapit.shared.tenant.TenantId;

class ChangeOwnPasswordTest {
    private final AuthenticatedPrincipal actor = new AuthenticatedPrincipal(UUID.randomUUID(), TenantId.of("tenant-a"), "a@example.test", UserRole.ADMIN, Instant.parse("2026-11-22T12:00:00Z"));
    private final OwnPasswordRepository repository = mock(OwnPasswordRepository.class);
    private final OwnProfileService profiles = mock(OwnProfileService.class);
    private final OwnPasswordChangeValidator validator = mock(OwnPasswordChangeValidator.class);
    private final PasswordHasher hasher = mock(PasswordHasher.class);
    private final OwnPasswordChange command = new OwnPasswordChange("CurrentSecret1!", "NewSecret2!", "NewSecret2!");
    private UserCredentials credential(Instant cutoff) { return new UserCredentials(new AuthenticatedUser(actor.id(), actor.tenantId(), actor.email(), "A", actor.role()), "old-hash", true, true, cutoff, null); }
    @Test void serializesCheckHashAndAtomicReplacementWithoutCredentialOrIdentityLeaks() {
        when(repository.lockOwn(actor)).thenReturn(Optional.of(credential(null))); when(hasher.hash(command.newPassword())).thenReturn("new-hash");
        when(repository.replaceOwn(actor, "old-hash", "new-hash")).thenReturn(true);
        new CommitOwnPasswordChange(repository, validator, hasher, profiles).execute(actor, command);
        var order = inOrder(repository, profiles, validator, hasher); order.verify(repository).lockOwn(actor); order.verify(profiles).read(actor);
        order.verify(validator).validate(command, Optional.of("old-hash")); order.verify(hasher).hash(command.newPassword()); order.verify(repository).replaceOwn(actor, "old-hash", "new-hash");
    }
    @Test void revalidatesRevocationAfterWaitingForLockAndRejectsEquality() {
        for (Instant cutoff : new Instant[] {actor.issuedAt(), actor.issuedAt().plusNanos(1)}) {
            when(repository.lockOwn(actor)).thenReturn(Optional.of(credential(cutoff)));
            assertThatThrownBy(() -> new CommitOwnPasswordChange(repository, validator, hasher, profiles).execute(actor, command)).isInstanceOf(OwnProfileFailure.class);
        }
        verifyNoInteractions(validator, hasher); verify(repository, never()).replaceOwn(any(), anyString(), anyString());
    }
    @Test void invalidCurrentPasswordDoesNotHashOrWriteAndConflictDoesNotReturnSuccess() {
        when(repository.lockOwn(actor)).thenReturn(Optional.of(credential(null)));
        doThrow(new OwnPasswordChangeFailure(OwnPasswordChangeFailure.Reason.INVALID_CURRENT_PASSWORD)).when(validator).validate(any(), any());
        assertThatThrownBy(() -> new CommitOwnPasswordChange(repository, validator, hasher, profiles).execute(actor, command)).isInstanceOf(OwnPasswordChangeFailure.class);
        verifyNoInteractions(hasher); verify(repository, never()).replaceOwn(any(), anyString(), anyString());
        reset(validator); when(hasher.hash(anyString())).thenReturn("new-hash");
        assertThatThrownBy(() -> new CommitOwnPasswordChange(repository, validator, hasher, profiles).execute(actor, command)).isInstanceOf(OwnProfileFailure.class);
    }
    @Test void consumesIndependentBudgetBeforeStartingWriterAndStopsOnRejection() {
        var limiter = mock(OwnPasswordAttemptLimiter.class); var writer = mock(CommitOwnPasswordChange.class);
        var useCase = new ChangeOwnPassword(profiles, limiter, writer); useCase.execute(actor, command, "real-address");
        var order = inOrder(profiles, limiter, writer); order.verify(profiles).read(actor); order.verify(limiter).checkPasswordChange(actor, "real-address"); order.verify(writer).execute(actor, command);
        reset(writer); doThrow(new OwnPasswordRateLimited(900)).when(limiter).checkPasswordChange(any(), anyString());
        assertThatThrownBy(() -> useCase.execute(actor, command, "real-address")).isInstanceOf(OwnPasswordRateLimited.class); verifyNoInteractions(writer);
    }

    @Test void refusesInactiveAccountsAndMismatchedTenantUserOrRoleBeforeHashing() {
        var own = credential(null).identity();
        var wrongTenant = new AuthenticatedUser(own.id(), TenantId.of("tenant-b"), own.email(), own.fullName(), own.role());
        var wrongUser = new AuthenticatedUser(UUID.randomUUID(), own.tenantId(), own.email(), own.fullName(), own.role());
        var wrongRole = new AuthenticatedUser(own.id(), own.tenantId(), own.email(), own.fullName(), UserRole.STAFF);
        for (var credential : new UserCredentials[] {
            new UserCredentials(own,"hash",false,true), new UserCredentials(own,"hash",true,false),
            new UserCredentials(wrongTenant,"hash",true,true), new UserCredentials(wrongUser,"hash",true,true),
            new UserCredentials(wrongRole,"hash",true,true)}) {
            when(repository.lockOwn(actor)).thenReturn(Optional.of(credential));
            assertThatThrownBy(() -> new CommitOwnPasswordChange(repository,validator,hasher,profiles).execute(actor,command))
                    .isInstanceOf(OwnProfileFailure.class);
        }
        verifyNoInteractions(validator,hasher,profiles);
        verify(repository,never()).replaceOwn(any(),anyString(),anyString());
    }
}
