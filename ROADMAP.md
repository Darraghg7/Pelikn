# Pelikn — Feature Roadmap

Potential features for future development, in no particular priority order.

---

## 🤖 AI Features

### AI Rota Builder
- Replace the current rule-based `buildRota()` with a Claude API call
- Handles natural language preferences ("keep John off Mondays"), complex availability constraints, and cost optimisation
- **Model:** Claude Haiku (cheapest, still capable)
- **Estimated cost:** ~$24/month at 1,000 venues (1 generation/week), ~$70/month at 3 generations/week
- **Monetisation:** Charge venues £5–10/month as a premium "AI Rota" add-on — covers API cost ~100x over at scale

---

## 📋 Notes

- Costs above are based on ~3,000 tokens per rota generation (input + output)
- Pricing should be re-evaluated against current Anthropic API rates before implementation
