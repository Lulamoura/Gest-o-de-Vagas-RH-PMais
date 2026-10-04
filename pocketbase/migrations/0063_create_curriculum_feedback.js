migrate(
  (app) => {
    var collection = new Collection({
      name: 'curriculum_feedback',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'schema_version', type: 'text', required: true, max: 80 },
        { name: 'operation', type: 'text', required: true, max: 80 },
        { name: 'vacancy_id', type: 'text', required: true, max: 160 },
        { name: 'wordpress_job_id', type: 'text', required: true, max: 20 },
        { name: 'application_id', type: 'text', required: true, max: 20 },
        { name: 'analysis_id', type: 'text', required: true, max: 160 },
        { name: 'analysis_version', type: 'text', required: true, max: 80 },
        {
          name: 'analysis_agent',
          type: 'select',
          required: true,
          values: ['iris'],
          maxSelect: 1,
        },
        { name: 'interpretation_request_id', type: 'text', required: true, max: 160 },
        { name: 'interpretation_model', type: 'text', required: true, max: 240 },
        { name: 'criteria_version', type: 'text', required: true, max: 160 },
        { name: 'source_fingerprint', type: 'text', required: true, max: 64 },
        { name: 'perception', type: 'text', required: true },
        { name: 'understanding', type: 'text', required: true },
        { name: 'justification', type: 'text', required: true },
        {
          name: 'confirmation',
          type: 'select',
          required: true,
          values: ['confirmed', 'complemented'],
          maxSelect: 1,
        },
        { name: 'complement', type: 'text', max: 4000 },
        { name: 'actor_id', type: 'text', required: true, max: 160 },
        {
          name: 'proof_expires_at',
          type: 'number',
          required: true,
          min: 1,
          onlyInt: true,
        },
        { name: 'proof_signature', type: 'text', required: true, max: 64 },
        {
          name: 'calibration_state',
          type: 'select',
          required: true,
          values: ['pending_review'],
          maxSelect: 1,
        },
        { name: 'idempotency_key', type: 'text', required: true, max: 64 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_curriculum_feedback_idempotency_key ON curriculum_feedback (idempotency_key)',
        'CREATE INDEX idx_curriculum_feedback_vacancy ON curriculum_feedback (vacancy_id)',
        'CREATE INDEX idx_curriculum_feedback_application ON curriculum_feedback (application_id)',
        'CREATE INDEX idx_curriculum_feedback_actor ON curriculum_feedback (actor_id)',
        'CREATE INDEX idx_curriculum_feedback_created ON curriculum_feedback (created DESC)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('curriculum_feedback'))
    } catch (_) {}
  },
)
