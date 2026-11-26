import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { STRINGS } from '../../../core/strings';
import { BusinessApplicationStore } from '../model/business-application-store';

@Component({
  selector: 'mp-business-application-page',
  imports: [RouterLink],
  providers: [BusinessApplicationStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './business-application-page.html',
  styleUrl: './business-application-page.scss',
})
export class BusinessApplicationPage {
  protected readonly copy = STRINGS.businessApplication;
  protected readonly store = inject(BusinessApplicationStore);

  protected submit(event: Event): void {
    event.preventDefault();
    this.store.submit();
  }
}
