export type Step = { title: string; hint?: string };

/** Progress indicator only; reaching a step never implies agreement or approval. */
export function Stepper({ steps, current, label }: { steps: readonly Step[]; current: number; label: string }) {
  return <ol className="stepper" aria-label={label}>
    {steps.map((step, index) => {
      const state = index < current ? "done" : index === current ? "current" : "upcoming";
      return <li key={step.title} className={"stepper-item stepper-" + state} aria-current={state === "current" ? "step" : undefined}>
        <span className="stepper-index" aria-hidden="true">{state === "done" ? "✓" : String(index + 1).padStart(2, "0")}</span>
        <span className="stepper-text"><strong>{step.title}</strong>{step.hint && <small>{step.hint}</small>}{state === "done" && <span className="sr-only"> (done)</span>}</span>
      </li>;
    })}
  </ol>;
}
