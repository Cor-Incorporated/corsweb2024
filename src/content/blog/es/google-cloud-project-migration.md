---
title: "Migré un proyecto completo de Google Cloud entre organizaciones y terminó en solo un día"
description: "El registro entre lágrimas de un desarrollador que llegó a crear scripts para migrar GCS poco a poco, solo para descubrir que se podía mover el proyecto entero"
summary: "Los proyectos de Google Cloud se pueden mover por completo incluso entre distintas organizaciones mediante gcloud beta projects move. Se abre un corredor de migración, se asignan permisos, se reasigna la cuenta de facturación tras el traslado y se eliminan las políticas y permisos habilitados. El comando de migración en sí se completó en menos de un minuto."
pubDate: 2025-07-24
updatedDate: 2026-10-23
author: "Terisuke"
category: "engineering"
tags: ["Google Cloud", "DevOps", "移行", "gcloud", "プロジェクト管理"]
image:
  url: "/images/blog/gcp-logo.avif"
  alt: "Logotipo de Google Cloud Platform"
lang: "es"
featured: false
translationSourceHash: "e931b0447ea24de7c5e3f41cbc9e772c31e92f20d0c727fd4e64f15c53057372"
translatedAt: "2026-10-23T06:25:25.041Z"
translationModel: "gemini-3.8-flash"
---

# Migré un proyecto completo de Google Cloud entre organizaciones y terminó en solo un día

Hola, soy Terisuke.

Hoy voy a contar una historia sobre cómo perdí una cantidad enorme de tiempo.

Tuvimos que organizar el entorno en la nube de la empresa y surgió la necesidad de mover un proyecto administrado en `company@example-a.com` a la organización de `company@example-b.com`.

Al principio estaba entusiasmado: "¡Bien, usaré Terraform y gcloud para migrar poco a poco los buckets de GCS y las instancias de Compute!".

Sin embargo, descubrí que, si se trata del mismo Google Cloud, existe una forma de mover el proyecto entero de una sola vez.

Como resultado, el script de migración de GCS que preparé con tanto esfuerzo quedó completamente inservible (lloro).

Aun así, para no volver a cometer el mismo error y a modo de recordatorio, resumo aquí el método.

## Requisitos previos

Esto es importante. Primero, es necesario cumplir con las siguientes condiciones:

- Contar con permisos de propietario (Owner) en ambas organizaciones.
- Que el proyecto a migrar no utilice VPC Service Controls ni Shared VPC.
- Que no utilice servicios de pago de Marketplace (sería necesario comprarlos de nuevo).

## Pasos de la migración que realicé

### 1. Confirmación de los IDs de organización

Primero, confirmamos los IDs de la organización de origen y de la de destino. Esto será fundamental para la configuración posterior.

```bash
# 移行元組織にログイン
gcloud config set account company@example-a.com
gcloud organizations list
# DISPLAY_NAME     ID             DIRECTORY_CUSTOMER_ID
# example-a.com    123456789012   C02xxxxxx

# 移行先組織にログイン  
gcloud config set account company@example-b.com
gcloud organizations list
# DISPLAY_NAME     ID             DIRECTORY_CUSTOMER_ID
# example-b.com    987654321098   C02yyyyyy
```

### 2. Comprobaciones previas

Revisa los siguientes puntos antes de la migración. Darse cuenta después de que aparezca un error es sumamente molesto.

```bash
# VPC Service Controlsの確認（エラーが出ればOK）
gcloud access-context-manager perimeters list

# Shared VPCの確認（{}が返ればOK）
gcloud compute shared-vpc get-host-project your-project-id

# 現在の請求アカウントをメモ
gcloud beta billing projects describe your-project-id
```

### 3. Configuración del corredor de migración

Esta es la parte más importante. Abrimos un "corredor de migración" para poder mover proyectos entre organizaciones. En resumen, es una configuración para que ambas organizaciones confíen entre sí.

En la organización de origen, se configura el permiso de exportación.
```bash
# export-policy.yamlを作成
cat > export-policy.yaml << EOF
name: organizations/123456789012/policies/resourcemanager.allowedExportDestinations
spec:
  rules:
    - values:
        allowedValues:
          - under:organizations/987654321098
EOF

# ポリシーを適用
gcloud org-policies set-policy export-policy.yaml
```

En la organización de destino, se configura el permiso de importación.
```bash
# 移行先組織にログイン
gcloud config set account company@example-b.com

# import-policy.yamlを作成
cat > import-policy.yaml << EOF
name: organizations/987654321098/policies/resourcemanager.allowedImportSources
spec:
  rules:
    - values:
        allowedValues:
          - under:organizations/123456789012
EOF

# ポリシーを適用
gcloud org-policies set-policy import-policy.yaml
```

### 4. Asignación de permisos

Aquí me quedé atascado. Incluso siendo propietario de la organización, se requerían permisos a nivel de proyecto. Me di cuenta tras encontrar un error; se necesitan los siguientes permisos:

```bash
# 移行元アカウントに戻る
gcloud config set account company@example-a.com

# プロジェクトと組織に権限を付与
gcloud projects add-iam-policy-binding your-project-id \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectMover"

gcloud organizations add-iam-policy-binding 123456789012 \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectMover"

# 移行先組織にも権限を付与（組織をまたいだ権限付与）
gcloud config set account company@example-b.com
gcloud organizations add-iam-policy-binding 987654321098 \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectCreator"
```

### 5. La migración definitiva

Una vez completados los preparativos, la migración se realiza con un solo comando.

```bash
# 移行元アカウントで実行
gcloud config set account company@example-a.com
gcloud beta projects move your-project-id --organization 987654321098
```

Aparecerá una advertencia, pero avanzamos con `Y`. La migración terminó en menos de un minuto. Fue tan rápido que me dejó desconcertado.

### 6. Cambio de la cuenta de facturación

El proyecto se movió, pero la cuenta de facturación sigue siendo la misma. Si olvidas esto, se seguirá facturando a la organización anterior y será un gran problema.

```bash
# 移行先アカウントに切り替え
gcloud config set account company@example-b.com

# 新しい請求先に紐付け
gcloud beta billing accounts list
gcloud beta billing projects link your-project-id --billing-account NEW-BILLING-ID
```

Aquí también apareció un error de permisos, por lo que fue necesario otorgar el rol de propietario del proyecto a la cuenta de destino.

```bash
# 移行元アカウントで実行
gcloud config set account company@example-a.com
gcloud projects add-iam-policy-binding your-project-id \
    --member="user:company@example-b.com" \
    --role="roles/owner"
```

### 7. Limpieza

Cerramos la "brecha de seguridad" que abrimos para la migración. Este paso es fundamental: si se olvida, continuará el estado en el que se pueden mover proyectos libremente entre las organizaciones.

```bash
# 組織ポリシーを削除
gcloud config set account company@example-a.com
gcloud org-policies delete resourcemanager.allowedExportDestinations --organization=123456789012

gcloud config set account company@example-b.com
gcloud org-policies delete resourcemanager.allowedImportSources --organization=987654321098

# 組織間の権限も削除
gcloud organizations remove-iam-policy-binding 987654321098 \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectCreator"
```

## Puntos a tener en cuenta tras la migración

- Las políticas de IAM heredadas se pierden. Es necesario volver a configurar los permisos otorgados a nivel de organización.
- Las alertas de presupuesto también deben volver a configurarse. La nueva cuenta de facturación no hereda las configuraciones de presupuesto.
- Es indispensable comprobar el funcionamiento de los servicios. Conviene revisar con especial atención los servicios con integraciones externas.

## La moraleja: el script de migración de GCS que quedó inservible

A decir verdad, al iniciar los trabajos de migración, llegué a programar un script para migrar los buckets de GCS a través de local.

https://github.com/terisuke/gcs-migration-project

Implementé descargas en paralelo, barra de progreso y manejo de errores, entusiasmado pensando: "¡Con esto podré migrar una gran cantidad de buckets fácilmente!".

Todo eso quedó completamente inutilizado en el momento en que supe que se podía mover el proyecto entero.

Aun así, me digo a mí mismo que no fue una pérdida de tiempo total: sirvió para aprender sobre el procesamiento en paralelo de gsutil y la manipulación de GCS con Python, y además servirá cuando no sea posible migrar entre organizaciones.

## Conclusión

La migración de proyectos en Google Cloud fue sorprendentemente sencilla siempre que se cuente con los permisos y la configuración adecuados. No obstante, no olvides limpiar la configuración de seguridad.

Si alguien tiene que hacer una migración similar, recomiendo investigar desde el principio la existencia de `gcloud beta projects move`. Reinventar la rueda es divertido, pero el tiempo es limitado.

Aun así, ojalá me devolvieran los tres días que pasé creando aquel script de migración de GCS.

---

Gracias por leer.

Si has pasado por una experiencia similar o tienes planeado realizar una migración pronto, cuéntamelo en los comentarios. Lloremos juntos, jaja.
