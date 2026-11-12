import {
  ChangeDetectionStrategy,
  Component,
  inject,
  type ElementRef,
  type OnInit,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { MemberInvitationRole, TenantUser } from '@mapit/api-client';
import { I18nService, LocalizedDatePipe } from '@mapit/i18n';

import { STRINGS } from '../../../../core/strings';
import { UsersStore } from '../model/users-store';

@Component({
  selector: 'mapit-users',
  imports: [ReactiveFormsModule, LocalizedDatePipe],
  providers: [UsersStore],
  templateUrl: './users.html',
  styleUrl: './users.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Users implements OnInit {
  protected readonly strings = STRINGS.users;
  protected readonly roles = STRINGS.shell.roleLabels;
  protected readonly store = inject(UsersStore);
  protected readonly locale = inject(I18nService).locale;
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('confirmation');
  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required.bind(Validators),
        Validators.email.bind(Validators),
        Validators.maxLength(254),
      ],
    }),
    role: new FormControl<MemberInvitationRole>('STAFF', {
      nonNullable: true,
      validators: [Validators.required.bind(Validators)],
    }),
  });

  ngOnInit(): void {
    this.store.load();
    this.store.loadInvitations(0);
  }

  protected invite(): void {
    if (this.form.invalid || this.store.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, role } = this.form.getRawValue();
    this.store.invite(email, role);
  }

  protected ask(user: TenantUser, kind: 'role' | 'deactivate'): void {
    this.store.ask(user, kind);
    if (this.store.pending()) this.dialog()?.nativeElement.showModal();
  }

  protected cancel(): void {
    this.dialog()?.nativeElement.close();
    this.store.pending.set(null);
  }

  protected confirm(): void {
    this.dialog()?.nativeElement.close();
    this.store.confirm();
  }
}
