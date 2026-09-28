---
title: "La migración completa de un proyecto de Google Cloud entre organizaciones se completó en un día"
description: "Los registros de las lágrimas de un desarrollador que había creado un script para migrar GCS poco a poco, solo para descubrir que los proyectos se podían mover enteros."
pubDate: 2025-07-24
author: "Terisuke"
category: "engineering"
tags: ["Google Cloud", "DevOps", "移行", "gcloud", "プロジェクト管理"]
image:
  url: "/images/blog/gcp-logo.avif"
  alt: "Google Cloud Platform ロゴ"
lang: "es"
featured: false
translationSourceHash: "65d2d8e4ee3fb4c439d95c88fea7fca7e8286479aa45bbc964a3c502518304aa"
translatedAt: "2026-09-28T06:09:16.025Z"
translationModel: "adopted-legacy"
---

# Cómo la migración completa de un proyecto de Google Cloud entre organizaciones se completó en un día

Hola, soy Terisuke.

Hoy, quiero contarles una historia sobre **cómo desperdicié mucho tiempo**.

Tuvimos que organizar nuestro entorno de nube y era necesario mover un proyecto gestionado por `company@example-a.com` a la organización `company@example-b.com`.

Al principio, estaba emocionado: "¡De acuerdo, usaré terraform y gcloud para migrar poco a poco los buckets de GCS y las instancias de Compute!".

**Sin embargo, descubrí que existe una forma de mover todo el proyecto de una vez si están en la misma organización de Google Cloud.**

Como resultado, el script de migración de GCS que había creado se volvió completamente inútil (llorando).

Pero para evitar tropezar con la misma piedra, resumiré ese método como un registro de memoria.

## Prerrequisitos (esto es importante)

Primero, debes cumplir las siguientes condiciones:

- ✅ Tener permisos de propietario en ambas organizaciones.
- ✅ El proyecto a migrar no utiliza VPC Service Controls ni Shared VPC.
- ✅ No se utilizan servicios de pago de Marketplace (será necesario volver a comprarlos).

## Flujo de Migración (Procedimiento Realizado)

### 1. Confirmación de ID de Organización

Primero, confirma los ID de las organizaciones de origen y destino. Esto es crucial para la configuración posterior.

```bash
# Iniciar sesión en la organización de origen
gcloud config set account company@example-a.com
gcloud organizations list
# DISPLAY_NAME     ID             DIRECTORY_CUSTOMER_ID
# example-a.com    123456789012   C02xxxxxx

# Iniciar sesión en la organización de destino
gcloud config set account company@example-b.com
gcloud organizations list
# DISPLAY_NAME     ID             DIRECTORY_CUSTOMER_ID
# example-b.com    987654321098   C02yyyyyy
```

### 2. Verificación Preliminar (Si hay problemas aquí, será molesto)

Verifica lo siguiente antes de la migración. Es realmente molesto darse cuenta de un error después de que ocurra.

```bash
# Verificación de VPC Service Controls (si hay un error, está bien)
gcloud access-context-manager perimeters list

# Verificación de Shared VPC (si devuelve {}, está bien)
gcloud compute shared-vpc get-host-project your-project-id

# Anota la cuenta de facturación actual
gcloud beta billing projects describe your-project-id
```

### 3. Configuración del Corredor de Migración (esto es clave)

Esta es la parte más importante. Establecemos un "corredor de migración" para permitir que los proyectos se muevan entre organizaciones. En resumen, es una configuración para que las organizaciones confíen mutuamente.

**Configurar permiso de exportación en la organización de origen:**
```bash
# Crear export-policy.yaml
cat > export-policy.yaml << EOF
name: organizations/123456789012/policies/resourcemanager.allowedExportDestinations
spec:
  rules:
    - values:
        allowedValues:
          - under:organizations/987654321098
EOF

# Aplicar la política
gcloud org-policies set-policy export-policy.yaml
```

**Configurar permiso de importación en la organización de destino:**
```bash
# Iniciar sesión en la organización de destino
gcloud config set account company@example-b.com

# Crear import-policy.yaml
cat > import-policy.yaml << EOF
name: organizations/987654321098/policies/resourcemanager.allowedImportSources
spec:
  rules:
    - values:
        allowedValues:
          - under:organizations/123456789012
EOF

# Aplicar la política
gcloud org-policies set-policy import-policy.yaml
```

### 4. Concesión de Permisos (aquí tuve problemas)

Incluso con permisos de propietario de organización, se requerían permisos a nivel de proyecto. Me di cuenta después de recibir un error, pero se requieren los siguientes permisos:

```bash
# Volver a la cuenta de origen
gcloud config set account company@example-a.com

# Conceder permisos al proyecto y a la organización
gcloud projects add-iam-policy-binding your-project-id \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectMover"

gcloud organizations add-iam-policy-binding 123456789012 \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectMover"

# Conceder permisos también a la organización de destino (concesión de permisos entre organizaciones)
gcloud config set account company@example-b.com
gcloud organizations add-iam-policy-binding 987654321098 \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectCreator"
```

### 5. ¡Finalmente la Migración (solo 1 comando)!

Una vez que todo esté listo, puedes migrar con solo un comando.

```bash
# Ejecutar con la cuenta de origen
gcloud config set account company@example-a.com
gcloud beta projects move your-project-id --organization 987654321098
```

Aparecerá una advertencia, pero procede con `Y`. **La migración se completó en menos de 1 minuto**. Fue tan rápido que me quedé boquiabierto.

### 6. Cambio de Cuenta de Facturación (es un problema si lo olvidas)

El proyecto se movió, pero la cuenta de facturación no. Si olvidas esto, la facturación seguirá yendo a la organización antigua.

```bash
# Cambiar a la cuenta de destino
gcloud config set account company@example-b.com

# Vincular a la nueva cuenta de facturación
gcloud beta billing accounts list
gcloud beta billing projects link your-project-id --billing-account NEW-BILLING-ID
```

Aquí también hubo un error de permisos, por lo que fue necesario conceder permisos de propietario del proyecto a la cuenta de destino.

```bash
# Ejecutar con la cuenta de origen
gcloud config set account company@example-a.com
gcloud projects add-iam-policy-binding your-project-id \
    --member="user:company@example-b.com" \
    --role="roles/owner"
```

### 7. Limpieza (muy importante)

Cierra el "agujero de seguridad" que abriste para la migración. Si olvidas esto, la capacidad de mover proyectos libremente entre organizaciones continuará.

```bash
# Eliminar políticas de organización
gcloud config set account company@example-a.com
gcloud org-policies delete resourcemanager.allowedExportDestinations --organization=123456789012

gcloud config set account company@example-b.com
gcloud org-policies delete resourcemanager.allowedImportSources --organization=987654321098

# Eliminar también permisos entre organizaciones
gcloud organizations remove-iam-policy-binding 987654321098 \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectCreator"
```

## Notas Post-Migración

- **Las políticas de IAM heredadas se pierden.** Los permisos otorgados a nivel de organización deberán ser reconfigurados.
- **Las alertas de presupuesto** también deben ser reconfiguradas. La configuración del presupuesto no se transfiere a la nueva cuenta de facturación.
- **La verificación del funcionamiento de los servicios** es esencial. Presta especial atención a los servicios que se integran externamente.

## El Desenlace: El Script de Migración de GCS Inútil

De hecho, al principio de la tarea de migración, incluso había creado un script para migrar buckets de GCS a través de una conexión local.

https://github.com/terisuke/gcs-migration-project

Implementé descargas paralelas, visualización de progreso y manejo de errores, y estaba emocionado: "¡Ahora puedo migrar fácilmente grandes cantidades de buckets!".

**En el momento en que descubrí que podía mover proyectos completos, todo se volvió inútil.**

Pero bueno, aprendí sobre el procesamiento paralelo de `gsutil` y la operación de GCS en Python, y si no puedes cruzar organizaciones, puedes usarlo, así que no es completamente inútil... me lo digo a mí mismo.

## Resumen

La migración de proyectos de Google Cloud fue sorprendentemente fácil, siempre que se tengan los permisos y la configuración correctos. Sin embargo, no olvides la limpieza de la configuración de seguridad.

Si alguien más tiene que realizar una tarea de migración similar, recomiendo buscar la existencia de `gcloud beta projects move` desde el principio. Re inventar la rueda es divertido, pero el tiempo es limitado.

Aún así, desearía que me devolvieran los 3 días que dediqué a crear ese script de migración de GCS.

---

**¡Gracias por leer!**

Si has tenido una experiencia similar, o si tienes previsto realizar tareas de migración, por favor, házmelo saber en los comentarios. Lloraremos juntos (¡jaja!).
