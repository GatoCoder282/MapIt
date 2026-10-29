import { test, expect } from '@playwright/test';
import { companyAdminFixture } from './company-admin-fixture';

/**
 * Test visual del dashboard home para verificar el layout contra la referencia.
 */
test.describe('Home Dashboard Visual', () => {
  let company: Awaited<ReturnType<typeof companyAdminFixture>>;
  test.beforeAll(async ({ request }) => {
    company = await companyAdminFixture(request);
  });
  test.beforeEach(async ({ page }) => {
    // ADMIN real de la empresa creada por este test.
    await page.goto('/empresa/' + company.slug + '/login');
    await page.fill('input[type="email"]', company.email);
    await page.fill('input[type="password"]', company.password);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/home/);
    await expect(page).toHaveURL(/\/home/);
    await expect(page.locator('h1')).toContainText('Gestiona, analiza y haz crecer');
  });

  test('debe mostrar el layout completo con sidebar oscuro', async ({ page }) => {
    // Desktop: el rail es visible de inmediato. En tablet (RNF07) el rail
    // colapsa en un drawer, que hay que abrir (y cerrar luego, porque el
    // scrim tapa el contenido) para verificar la navegación.
    const sidebar = page.locator('.sidebar');
    if (await sidebar.isVisible()) {
      // Verificar el logo en el sidebar (ahora es una imagen con texto alternativo)
      await expect(page.getByAltText('MapIt').first()).toBeVisible();

      // Verificar navegación
      await expect(page.locator('text=Inicio').first()).toBeVisible();
      await expect(page.locator('text=Negocios').first()).toBeVisible();
    } else {
      await page.getByRole('button', { name: 'Abrir navegación' }).click();
      await expect(page.getByRole('navigation', { name: 'Navegación móvil' })).toBeVisible();
      const drawer = page.locator('.drawer');
      await expect(drawer.getByAltText('MapIt')).toBeVisible();
      await expect(drawer.getByRole('link', { name: 'Inicio' })).toBeVisible();
      await expect(drawer.getByRole('link', { name: 'Negocios' })).toBeVisible();
      await page.locator('.scrim').click();
    }

    // Verificar topbar (el buscador se retiró del shell; queda el aviso)
    await expect(page.locator('.notification-btn')).toBeVisible();

    // Verificar KPIs
    await expect(page.locator('text=TOTAL DE NEGOCIOS')).toBeVisible();

    // Verificar el panel de crecimiento (el de distribución se retiró)
    await expect(page.locator('text=Crecimiento de negocios')).toBeVisible();

    // Verificar aside (accesos rápidos)
    await expect(page.locator('text=Accesos rápidos')).toBeVisible();

    // Capturar screenshot para comparación
    await page.screenshot({
      path: 'screenshots/home-dashboard-actual.png',
      fullPage: true,
    });
  });

  test('debe tener el sidebar con fondo oscuro', async ({ page }) => {
    const sidebar = page.locator('.sidebar .rail');
    const bgColor = await sidebar.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Verificar que el fondo sea oscuro (aproximadamente #0b132b)
    expect(bgColor).toMatch(/rgb\(11,\s*19,\s*43\)/);
  });

  test('debe mostrar todos los paneles principales', async ({ page }) => {
    // Hero section
    await expect(page.locator('.hero')).toBeVisible();
    await expect(page.locator('.hero-decor')).toBeVisible();

    // KPIs de empresa: negocios, reservas y ocupación.
    await expect(page.locator('.kpis')).toBeVisible();
    const kpiCards = page.locator('.kpi');
    await expect(kpiCards).toHaveCount(3);
    await expect(page.getByTestId('home-kpi-ocupacion')).toBeVisible();

    // Panel de ocupación en vivo: los cinco estados con su color
    await expect(page.getByTestId('home-panel-ocupacion')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ocupación en vivo' })).toBeVisible();

    // Main panels
    await expect(page.locator('text=Crecimiento de negocios')).toBeVisible();
    await expect(page.locator('text=Reservas y pagos')).toBeVisible();

    // Aside panels
    await expect(page.locator('text=Accesos rápidos')).toBeVisible();
    await expect(page.locator('text=Más negocios, mayor impacto')).toBeVisible();
  });
});
