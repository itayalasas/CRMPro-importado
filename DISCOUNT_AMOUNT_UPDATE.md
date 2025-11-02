# Actualización: discount_amount en Order Items

## Cambio en el JSON de DogCatify

Se agregó un nuevo campo `discount_amount` a los items que representa el valor absoluto del descuento aplicado:

```json
{
  "items": [
    {
      "id": "item-uuid",
      "name": "Baño completo",
      "original_price": 650,
      "discount_percentage": 18,
      "discount_amount": 117.00,  // NUEVO CAMPO
      "price": 532.79,
      "subtotal": 436.71,
      "iva_amount": 96.08,
      "quantity": 1
    }
  ]
}
```

## Cambios en la Base de Datos

### 1. Nueva columna en `order_items`
- Se agregó la columna `discount_amount` (numeric, default 0)
- Almacena el valor absoluto del descuento en la moneda del item

### 2. Webhook `dogcatify-order-webhook`

El webhook debe actualizar la inserción de `order_items` para incluir:

```typescript
await supabase.from("order_items").insert({
  order_id: order.id,
  product_name: item.name,
  description: item.name,
  quantity: item.quantity,
  unit_price: o.subtotal / item.quantity,
  discount_percent: item.discount_percentage || 0,
  discount_amount: item.discount_amount || 0,  // NUEVO
  line_total: o.subtotal,
  total_price: o.subtotal,
  currency: item.currency,
  item_type: item.type || 'product'
});
```

## Cálculo de Totales

**Estructura correcta según DogCatify:**

```
Precio Original: $650.00
Descuento (18%): -$117.00
─────────────────────────
Precio Final: $532.79 (con IVA incluido)

Desglose:
- Subtotal (sin IVA): $436.71
- IVA (22%): $96.08
─────────────────────────
Total: $532.79
```

## Notas Importantes

1. El `discount_amount` ya está aplicado en el `price` y `subtotal` que vienen de DogCatify
2. El campo `discount_amount` es informativo para mostrar al usuario cuánto se ahorró
3. Los totales en la orden deben seguir usando `totals.subtotal`, `totals.iva_amount` y `totals.total_amount`
4. Si `discount_amount` no viene en el JSON (órdenes antiguas), debe ser `0`
