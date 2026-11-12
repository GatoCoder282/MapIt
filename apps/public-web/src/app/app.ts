import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SiteNav } from '@mapit/ui-kit';

@Component({
  selector: 'mp-root',
  imports: [RouterOutlet, SiteNav],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<mapit-ui-site-nav [compact]="true" /><router-outlet />`,
})
export class App {}
