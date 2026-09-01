migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('vacancies')

    if (!col.fields.getByName('wordpress_curriculos_count')) {
      col.fields.add(
        new NumberField({
          name: 'wordpress_curriculos_count',
          min: 0,
          onlyInt: true,
        }),
      )
    }
    if (!col.fields.getByName('wordpress_curriculos_synced_at')) {
      col.fields.add(new DateField({ name: 'wordpress_curriculos_synced_at' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('vacancies')
    const count = col.fields.getByName('wordpress_curriculos_count')
    const syncedAt = col.fields.getByName('wordpress_curriculos_synced_at')

    if (count) col.fields.remove(count)
    if (syncedAt) col.fields.remove(syncedAt)
    app.save(col)
  },
)
