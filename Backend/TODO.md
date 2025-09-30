# TODO: Pruebas Backend

## Pruebas E2E

### Pasos a Completar

- [ ] Corregir sintaxis y código incompleto en auth.e2e-spec.ts
- [ ] Mejorar helpers de creación de datos de prueba en ambos archivos
- [ ] Verificar aserciones y manejo de errores en todos los casos de prueba
- [ ] Asegurar limpieza adecuada de la base de datos y reinicio de secuencias
- [ ] Ejecutar pruebas para verificar correcciones

### Estado Actual
- Archivos analizados: auth.e2e-spec.ts, city.e2e-spec.ts
- Problemas identificados: código incompleto, helpers mal definidos
- Próximo paso: comenzar correcciones

## Pruebas Unitarias

### Pasos a Completar

- [x] Crear pruebas unitarias para country.service.ts
  - [x] Configurar módulo de prueba con mocks
  - [x] Probar método create (casos de éxito y conflicto)
  - [x] Probar método findAll (paginación, ordenamiento)
  - [x] Probar método findOne (encontrado/no encontrado)
  - [x] Probar método findOneByName
  - [x] Probar método searchByName
  - [x] Probar métodos updatePut y updatePatch
  - [x] Probar método remove (con/sin dependencias)
- [x] Ejecutar pruebas y verificar cobertura (7 tests fallando, necesitan corrección)
- [ ] Corregir pruebas fallidas:
  - [ ] Arreglar test de create con código existente
  - [ ] Arreglar test de searchByName con paginación
  - [ ] Arreglar tests de updatePut y updatePatch
  - [ ] Arreglar tests de remove
  - [ ] Resolver errores de TypeScript

### Estado Actual
- Archivo creado: src/country/country.service.spec.ts
- Tests ejecutados: 69 total, 62 pasaron, 7 fallaron
- Próximo paso: corregir pruebas fallidas
