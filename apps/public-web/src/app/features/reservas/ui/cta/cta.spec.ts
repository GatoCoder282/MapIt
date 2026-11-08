import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ReservasCta } from './cta';

describe('ReservasCta', () => {
  it('enfoca el catálogo sin navegar y conserva la apertura en otra pestaña', () => {
    TestBed.configureTestingModule({ imports: [ReservasCta] });
    TestBed.overrideComponent(ReservasCta, { set: { imports: [] } });
    const fixture = TestBed.createComponent(ReservasCta);
    const catalog = document.createElement('section');
    catalog.id = 'mas-populares';
    catalog.tabIndex = -1;
    const scroll = vi.fn();
    catalog.scrollIntoView = scroll;
    document.body.append(catalog);
    try {
      fixture.detectChanges();
      const link = fixture.debugElement.query(By.css('a'));
      const click = new MouseEvent('click', { cancelable: true });
      link.triggerEventHandler('click', click);
      expect(click.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(catalog);
      expect(scroll).toHaveBeenCalledOnce();

      const newTab = new MouseEvent('click', { ctrlKey: true, cancelable: true });
      link.triggerEventHandler('click', newTab);
      expect(newTab.defaultPrevented).toBe(false);
      expect(scroll).toHaveBeenCalledOnce();
      expect(link.attributes['href']).toBe('/reservas#mas-populares');
    } finally {
      catalog.remove();
      fixture.destroy();
      TestBed.resetTestingModule();
    }
  });
});
