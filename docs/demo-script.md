# Three-minute presentation

1. Before presenting: start the app, leave **Use cached results** enabled, and select
   **Savings into Tesla**. The cache is a real historical mock run, not live inference.
2. 0:00–0:40: Compare both paths. Show the risky recommendation on the left, the general
   information on the right, and the OUT-02 trace. Explain that NeMo runs the rails.
3. 0:40–1:15: Choose **Numbers without evidence**. Show the unsupported figures,
   corrected response and grounding evidence. State that sources are fictional.
4. 1:15–1:50: Choose **An acquisition before announcement**. Explain that the input
   is escalated and the answer-model call is withheld.
5. 1:50–2:20: Show **A customer reply about AML**, then **A biased decision**. Point out
   tipping-off prevention and the human-review flag; no real notification is sent.
6. 2:20–3:00: Open Evaluation. State which model generated the selected run, show
   false positives as well as improvements, then open Audit and verify the chain.

If the API is unavailable, remain in cached Demo mode and use Run all scenarios.
Evaluation and Audit require the backend. Do not imply cached results are new audit
entries. Presentation mode supports arrow keys outside form controls and Escape.
