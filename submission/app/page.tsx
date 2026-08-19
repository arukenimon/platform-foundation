const repositoryUrl = "https://github.com/arukenimon/platform-foundation";
const transcriptUrl = `${repositoryUrl}/blob/master/AI_TRANSCRIPT.md`;

const findings = [
  {
    number: "01",
    title: "Tenant context can outlive the request",
    severity: "Critical",
    consequence: "The tenant identifier is interpolated into SQL and stored with session scope on a pooled connection. If validation ever weakens, the interpolation becomes an injection path; if setup or cleanup fails, the next borrower can inherit the previous tenant context and cross an organisation boundary.",
    response: "Validate a UUID, wrap every request in a transaction, and set the value with parameterised set_config(..., true) so it is transaction-local. Verify that app_user neither owns tenant tables nor has BYPASSRLS, and add isolation tests around failed requests and pool reuse.",
  },
  {
    number: "02",
    title: "Clinic field-level access is not established",
    severity: "Critical",
    consequence: "RLS separates tenants, not fields within a row. The handover does not show how reception is prevented from receiving clinical notes or how access to national IDs is constrained. For a live clinic, an undocumented control is not one I would accept without verification.",
    response: "Block sign-off until every role-to-field projection is verified. Enforce projections in the API, avoid SELECT *, encrypt sensitive values, audit sensitive reads, and add negative authorisation tests for every clinic role.",
  },
  {
    number: "03",
    title: "The audit log is outside tenant isolation",
    severity: "Critical",
    consequence: "audit_log has no tenant_id or RLS policy, while its free-form payload can capture personal or clinical data. Centralising it for debugging makes accidental cross-client access and regulatory over-retention more likely.",
    response: "Add a non-null tenant_id, tenant-scoped access, payload minimisation, retention rules, and append-only privileges. Administrative access should itself be audited, and sensitive payloads should be redacted or encrypted.",
  },
  {
    number: "04",
    title: "Record creation couples success to a provider call",
    severity: "Serious",
    consequence: "The database insert commits before the synchronous SMS or email call finishes. A provider outage can turn a successful write into an API error; a caller retry can then create a duplicate. Provider acceptance also does not prove delivery.",
    response: "Write a notification event through the existing transactional outbox, return the created record with notification status, and require an idempotency key on create requests. Delivery state should be updated asynchronously.",
  },
  {
    number: "05",
    title: "Outbox deduplication is too coarse",
    severity: "Serious",
    consequence: "Using (event_type, entity_id) treats every status_changed event for the same record as the same event. A legitimate second transition can be skipped, so notifications or downstream state disappear without a retry fixing them.",
    response: "Assign every outbox row an immutable event_id and deduplicate on that identifier. Consumer effects should record the event ID in the same transaction as their state change.",
  },
  {
    number: "06",
    title: "The platform boundary is still client-shaped",
    severity: "Serious",
    consequence: "Separate reports, applications, and referrals tables with separate status enums mean the unknown fourth client can still require schema and route code. JSONB custom fields solve field additions, but not workflow, permissions, notifications, or renamed statuses.",
    response: "Make record types, stable field identifiers, workflow transitions, role capabilities, and notification templates versioned configuration. Keep typed domain extensions for genuinely different behaviour rather than forcing all data into a universal JSON blob.",
  },
  {
    number: "07",
    title: "List pagination will degrade and drift",
    severity: "Serious",
    consequence: "Large OFFSET values become progressively expensive, and ordering only by created_at is unstable when timestamps tie. An unbounded limit also lets one request consume disproportionate database work.",
    response: "Cap page size, use a cursor over (created_at, id), and add a matching (tenant_id, created_at DESC, id DESC) index. The interpolated table identifier must come from a server-side allowlist.",
  },
  {
    number: "08",
    title: "There is no noisy-neighbour control",
    severity: "Serious",
    consequence: "One tenant's storm, import, or faulty integration can exhaust shared workers and database connections. Other tenants then miss their own response-time and notification expectations.",
    response: "Introduce per-tenant request and job quotas, bounded concurrency, fair queue scheduling, and explicit back-pressure. Track throttling and queue lag by tenant before adding more clients.",
  },
  {
    number: "09",
    title: "Search and entitlements are real but not urgent",
    severity: "Minor",
    consequence: "SQL-backed lists will not satisfy future free-text discovery, and all tenants receiving every feature limits packaging. Neither gap is the immediate safety or correctness constraint at the stated volume.",
    response: "Add measured PostgreSQL search indexes before introducing a separate search service, and implement entitlements when commercial packaging needs them. I would not place either ahead of isolation, privacy, or delivery correctness.",
  },
];

const decisions = [
  {
    number: "1",
    title: "Isolation",
    lead: "I would standardise on customer-controlled, single-tenant deployments.",
    paragraphs: [
      "Client C's requirement is a hard boundary: its data cannot leave infrastructure controlled by the clinic. A pooled SaaS cannot satisfy that condition through stronger RLS or contractual language. I would therefore ship the same immutable application and configuration model into infrastructure owned or controlled by each client.",
      "This is not a hybrid. Every client receives the same deployment shape, including clients that do not require it. Provisioning, upgrades, telemetry, and configuration must be automated centrally, but application data and runtime infrastructure remain inside the client's boundary.",
      "I give up the lowest possible unit cost and would likely lose Client A if that requirement is absolute. I accept that loss because a cost preference can be negotiated; a regulatory prohibition cannot. The platform still removes custom code, but its economic model becomes managed single tenancy rather than pooled SaaS.",
    ],
  },
  {
    number: "2",
    title: "The eligibility score",
    lead: "I would put scoring in a constrained, versioned policy component.",
    paragraphs: [
      "The formula should not live in route handlers, the field validator, or mutable round configuration. Each funding round pins an immutable policy version. A policy declares its typed inputs, supported calculations, weights, threshold, and an explanation template; publishing a board change creates a new version rather than editing history.",
      "For every application I would store the policy version, the registry response or source snapshot, derived components, final score, threshold, and decision explanation. If the registry is unavailable or stale beyond policy, the application becomes scoring_pending and is not silently assigned zero or automatically rejected.",
      "If Client C later asks for a similar mechanism, it receives a different versioned policy using the same small vocabulary. A requirement outside that vocabulary triggers an explicit engine extension and migration review, not tenant-specific code or arbitrary JavaScript embedded in configuration.",
    ],
  },
  {
    number: "3",
    title: "What breaks first at 300 clients",
    lead: "The fleet release and migration control plane fails first.",
    paragraphs: [
      "Under the single-tenant choice, 300 clients means 300 independently controlled environments. The first failure is not raw request throughput; it is the ability to know which version, schema, configuration, and security patch every environment is actually running.",
      "The symptoms are version drift, partially applied migrations, slower onboarding, emergency patches that cannot reach the whole fleet, and support incidents that only reproduce in a subset of clients. Eventually the platform team becomes the deployment queue.",
      "I would address it with immutable release artifacts, infrastructure-as-code, a central inventory of desired and observed state, preflight migration checks, canary cohorts, resumable rollout waves, and fleet-wide telemetry. A release should halt automatically when its error or migration threshold is crossed, while each client retains control of its infrastructure boundary.",
    ],
  },
];

function Severity({ level }: { level: string }) {
  return <span className={`severity severity-${level.toLowerCase()}`}>{level}</span>;
}

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>

      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Back to top">
          <span className="wordmark-mark">PF</span>
          <span>Platform Foundation</span>
        </a>
        <nav aria-label="Submission sections">
          <a href="#review">Review</a>
          <a href="#library">Library</a>
          <a href="#decisions">Decisions</a>
          <a href="#ai-use">AI use</a>
        </nav>
        <a className="header-link" href={repositoryUrl} target="_blank" rel="noreferrer">Repository <span aria-hidden="true">↗</span></a>
      </header>

      <main id="main-content">
        <section className="hero" id="top">
          <div className="hero-kicker">Benoz.AI · Senior Full Stack Developer · Take-home exercise</div>
          <div className="hero-grid">
            <div>
              <h1>Judgment before machinery.</h1>
              <p className="hero-copy">A review of the inherited platform, a deliberately bounded extension to its validation library, and three decisions I would be prepared to operate in production.</p>
              <div className="hero-actions">
                <a className="button button-primary" href={repositoryUrl} target="_blank" rel="noreferrer">View source and tests <span aria-hidden="true">↗</span></a>
                <a className="button button-secondary" href="#review">Read the review</a>
              </div>
            </div>
            <aside className="candidate-card" aria-label="Submission details">
              <div><span>Candidate</span><strong>Michael John C. Revilla</strong></div>
              <div><span>Implementation</span><strong>32 tests passing</strong></div>
              <div><span>Submitted</span><strong>August 2026 · PHT</strong></div>
            </aside>
          </div>
        </section>

        <section className="section section-review" id="review">
          <div className="section-heading">
            <span className="part-label">Part 1</span>
            <div><h2>Review of the handover</h2><p>I treated the notes as a production handover, not a list of claims to accept. The issues below are ordered by safety and correctness before convenience.</p></div>
          </div>

          <div className="finding-list">
            {findings.map((finding) => (
              <article className="finding" key={finding.number}>
                <div className="finding-index">{finding.number}</div>
                <div className="finding-body">
                  <div className="finding-title-row"><h3>{finding.title}</h3><Severity level={finding.severity} /></div>
                  <div className="finding-columns">
                    <div><h4>What goes wrong</h4><p>{finding.consequence}</p></div>
                    <div><h4>What I would do</h4><p>{finding.response}</p></div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="priority-callout">
            <span>First fix</span>
            <div><h3>Make tenant context transaction-local and fail closed.</h3><p>It is the shared isolation boundary beneath every route and tenant table. A failure there has the widest blast radius, including exposure of clinic data. I would fix it before feature work, then immediately verify clinic field projections and isolate the audit log.</p></div>
          </div>

          <div className="sound-choices">
            <h3>What I would keep</h3>
            <ul>
              <li>PostgreSQL RLS as database-level defence in depth.</li>
              <li>A separate low-privilege request role and migration role.</li>
              <li>The transactional outbox pattern, with corrected event identity.</li>
              <li>A maintained JWT library rather than home-grown cryptography.</li>
              <li>JSONB for sparse custom fields, without asking it to model every workflow.</li>
            </ul>
          </div>
        </section>

        <section className="section section-library" id="library">
          <div className="section-heading">
            <span className="part-label">Part 2</span>
            <div><h2>A small cross-field vocabulary</h2><p>I added one generic comparison rule rather than a client-specific condition or an expression language. The README is the contract; the implementation follows it.</p></div>
          </div>

          <div className="library-grid">
            <div className="code-panel">
              <div className="code-panel-bar"><span>client definition</span><span>JSON</span></div>
              <pre><code>{`{
  "cross_field_rules": [
    {
      "type": "compare",
      "field": "project_end_date",
      "operator": "gte",
      "other_field": "project_start_date",
      "message": "Project end date must not be
        before project start date"
    }
  ]
}`}</code></pre>
            </div>

            <div className="rule-decisions">
              <article><span>01</span><h3>References</h3><p><code>field</code> is the left operand; <code>other_field</code> is its dependency. Both names must exist.</p></article>
              <article><span>02</span><h3>Error ownership</h3><p>A failed rule reports against <code>field</code>, the value the user needs to correct.</p></article>
              <article><span>03</span><h3>Dependency failure</h3><p>The rule skips missing or individually invalid operands, leaving the existing field error authoritative.</p></article>
              <article><span>04</span><h3>Configuration failure</h3><p>Unknown references, operators, or incompatible types throw <code>TypeError</code> instead of silently admitting data.</p></article>
            </div>
          </div>

          <div className="operator-row">
            <div><span>Ordered types</span><strong>date · number</strong><small>eq · neq · gt · gte · lt · lte</small></div>
            <div><span>Equality types</span><strong>text · long_text · boolean · choice</strong><small>eq · neq</small></div>
            <div><span>Boundary</span><strong>No arbitrary expressions</strong><small>No eval, async lookups, arithmetic, or client handlers</small></div>
          </div>

          <div className="test-result">
            <div className="test-count">32<span>/32</span></div>
            <div><h3>All tests pass</h3><p>The original 16 tests are unchanged. Sixteen additions cover comparison order, equal boundaries, missing and invalid dependencies, optional fields, malformed rules, strict calendar dates, and non-finite numbers.</p></div>
            <a href={`${repositoryUrl}#cross-field-rule-format`} target="_blank" rel="noreferrer">Read the specification <span aria-hidden="true">↗</span></a>
          </div>
        </section>

        <section className="section section-decisions" id="decisions">
          <div className="section-heading">
            <span className="part-label">Part 3</span>
            <div><h2>Three decisions</h2><p>Each choice is intentionally singular. The trade-offs are part of the answer, not caveats hidden at the end.</p></div>
          </div>

          <div className="decision-list">
            {decisions.map((decision) => (
              <article className="decision" key={decision.number}>
                <div className="decision-number">Decision {decision.number}</div>
                <h3>{decision.title}</h3>
                <p className="decision-lead">{decision.lead}</p>
                <div className="decision-copy">{decision.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="section section-ai" id="ai-use">
          <div className="section-heading">
            <span className="part-label">Part 4</span>
            <div><h2>How I used AI</h2><p>I used AI as a reviewer and implementation partner. I did not delegate the final trade-offs to it.</p></div>
          </div>

          <div className="transcript-callout">
            <div><span>Public record</span><h3>Verbatim Codex conversation</h3><p>The exact visible user and assistant messages cover the investigation, trade-offs, implementation decisions, deployment troubleshooting, and publication steps. The export notes identify the non-conversational data that is excluded.</p></div>
            <a className="transcript-link" href={transcriptUrl} target="_blank" rel="noreferrer">Read transcript <span aria-hidden="true">↗</span></a>
          </div>

          <div className="ai-notes">
            <article><span>Tools and purpose</span><h3>Codex · GPT-5.6 Sol</h3><p>I used the Codex desktop agent with High reasoning to inspect the handover and repository, challenge architecture claims, test edge cases, implement and review the validation extension, run the suite, and build the submission page. I used GitHub for source history and Vercel for the public deployment.</p></article>
            <article><span>A suggestion I rejected</span><h3>Expanding the validator’s scope</h3><p>AI surfaced malformed configured regular expressions and a broader expression engine as adjacent work. I did not add either. Regex configuration semantics are unrelated to the requested extension, and a general rule language would make review, validation, and future migration harder. I kept a small typed comparison vocabulary.</p></article>
            <article><span>Where AI helped least</span><h3>The commercial isolation choice</h3><p>AI was useful for enumerating technical consequences, but it cannot know Benoz.AI’s appetite for losing a low-cost public client versus a regulated clinic. I made the final choice by treating the regulatory boundary as non-negotiable and accepting the resulting business loss.</p></article>
            <article><span>What I left out and doubt most</span><h3>A boundary, not a miniature platform</h3><p>I did not implement the handover fixes, a general policy engine, deployment automation, or a production security audit. I am least confident in the commercial assumption behind choosing dedicated deployments; without margin, contract, and regulator details, that is a reasoned platform position rather than a measured business conclusion.</p></article>
          </div>
        </section>
      </main>

      <footer>
        <div><strong>Platform Foundation</strong><span>Michael John C. Revilla · August 2026</span></div>
        <a href={repositoryUrl} target="_blank" rel="noreferrer">github.com/arukenimon/platform-foundation</a>
      </footer>
    </>
  );
}
