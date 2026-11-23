import { elementTypesFor, genericModels, mapDefinition } from './element-catalog';

describe('element catalog', () => {
  it('matches the vertical policy and keeps unknown establishments closed', () => {
    expect(elementTypesFor(null)).toEqual([]);
    expect(elementTypesFor('HOTEL')).toEqual(['ROOM', 'DECOR']);
    expect(elementTypesFor('RESTAURANT')).not.toContain('SEAT');
    expect(elementTypesFor('NIGHTCLUB')).not.toContain('ROOM');
    expect(elementTypesFor('EVENT_HALL')).toContain('SEAT');
  });
  it('provides the four distinct table models with wider rectangular and oval footprints', () => {
    const models = genericModels('TABLE');
    expect(models.map((model) => model.finish?.variant)).toEqual([
      'round',
      'square',
      'rectangle',
      'oval',
    ]);
    expect(models[3]!.size.width).toBeGreaterThan(models[3]!.size.height);
    expect(new Set(models.map((model) => model.key)).size).toBe(4);
  });
});

describe('multi-vertical definitions', () => {
  it.each(['RESTAURANT', 'NIGHTCLUB', 'HOTEL', 'EVENT_HALL'] as const)(
    'keeps %s models inside its policy and categories',
    (vertical) => {
      const definition = mapDefinition(vertical);
      expect(definition.categories.length).toBeGreaterThanOrEqual(4);
      expect(new Set(definition.models.map((model) => model.key)).size).toBe(
        definition.models.length,
      );
      for (const model of definition.models) {
        expect(elementTypesFor(vertical)).toContain(model.type);
        expect(definition.categories.some((category) => category.key === model.category)).toBe(
          true,
        );
        expect(model.size.width).toBeGreaterThan(0);
        expect(model.finish?.variant).toBeTruthy();
      }
    },
  );
  it('uses individual seats and tables for composed event arrangements', () => {
    const models = mapDefinition('EVENT_HALL').models;
    expect(models.find((model) => model.key === 'model:auditorium')).toMatchObject({
      type: 'SEAT',
      arrangement: { rows: 3, columns: 4 },
    });
    expect(models.find((model) => model.key === 'model:banquet')).toMatchObject({
      type: 'TABLE',
      arrangement: { rows: 2, columns: 3 },
    });
    expect(mapDefinition(null).models).toEqual([]);
  });
});
