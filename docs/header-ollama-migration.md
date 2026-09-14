## Plan: Migrate to Ollama for Header Classification

Here's a comprehensive plan to switch your GitHub Actions workflow from GitHub Models API to Ollama:

### **Phase 1: Local Testing (Your Machine)**

1. **Install Ollama**
   - Download from [ollama.ai](https://ollama.ai)
   - Pull a lightweight model: `ollama pull mistral` (7B, ~4GB)
   - Start the server: `ollama serve` (runs on `http://localhost:11434`)

2. **Update `rfc-agent.ts`**

   ```typescript
   // Replace lines 52-59
   const baseURL = process.env["OLLAMA_BASE_URL"] || "http://localhost:11434/v1";
   const apiKey = process.env["OLLAMA_API_KEY"] || "ollama"; // Dummy key for local

   const client = new OpenAI({
     apiKey,
     baseURL,
     timeout: 60000, // Ollama can be slower
     maxRetries: 1,
   });

   // Line 120: Change model
   model: "mistral", // or "neural-chat", "openchat" for faster inference
   ```

3. **Test locally**
   ```bash
   cd express-zod-api
   pnpm install
   OLLAMA_BASE_URL=http://localhost:11434/v1 pnpm node tools/headers.ts
   ```

### **Phase 2: GitHub Actions Setup**

4. **Add Ollama to CI/CD**

   Modify `.github/workflows/headers.yml`:

   ```yaml
   jobs:
     run-bash-and-pr:
       runs-on: ubuntu-latest

       services:
         ollama:
           image: ollama/ollama:latest
           options: >-
             --health-cmd "curl -f http://localhost:11434/api/tags || exit 1"
             --health-interval 10s
             --health-timeout 5s
             --health-retries 5
           ports:
             - 11434:11434

       steps:
         - name: Checkout repository
           uses: actions/checkout@v7

         - name: Pull Ollama model
           run: |
             for i in {1..30}; do
               if curl -f http://localhost:11434/api/tags; then
                 echo "Ollama ready"
                 break
               fi
               echo "Waiting for Ollama... ($i/30)"
               sleep 2
             done
             curl http://localhost:11434/api/pull -d '{"name": "mistral"}' || true

         - uses: fregante/setup-git-user@v2
         - uses: pnpm/action-setup@v6

         - uses: actions/setup-node@v7
           with:
             node-version: 24
             cache: pnpm

         - name: Install dependencies
           run: pnpm install

         - name: Check for new headers on IANA.ORG
           run: pnpm node tools/headers.ts
           env:
             OLLAMA_BASE_URL: http://localhost:11434/v1

         # Rest of workflow stays the same...
   ```

5. **Add error handling & retry logic** to `rfc-agent.ts` (line 126):
   ```typescript
   let completion;
   let retries = 0;
   const maxRetries = 3;

   while (retries < maxRetries) {
     try {
       completion = await client.chat.completions.create(agentConfig);
       break;
     } catch (error: any) {
       retries++;
       if (retries >= maxRetries) throw error;
       console.warn(
         `Request failed (attempt ${retries}/${maxRetries}). Retrying in 10s...`,
       );
       await new Promise((r) => setTimeout(r, 10000));
     }
   }
   ```

### **Phase 3: Optimization & Tuning**

6. **Optimize prompts** for Ollama (models are less capable than GPT-4)
   - Simplify system prompt (line 95-101)
   - Add more context examples
   - Reduce the number of headers per batch if needed

7. **Performance tuning**
   - Test different models: `mistral`, `neural-chat`, `openhermes`
   - Adjust `temperature` and `top_p` (line 122-123)
   - Monitor runner logs for inference speed

### **Phase 4: Production Deployment**

8. **Use pre-built container image**
   - Cache the Ollama container image to speed up CI runs
   - Or: Pre-pull the model into a custom GitHub Actions runner

9. **Monitor & adjust**
   - Run the workflow a few times manually
   - Check accuracy of header classifications
   - Fine-tune model selection based on speed/quality tradeoff

---

### **Implementation Priority**

**Start with:** Phase 1 + Phase 2 (basic integration)
**Then iterate on:** Phase 3 (optimization)
**Finally:** Phase 4 (production hardening)

### **Trade-offs**

| Aspect      | GitHub Models           | Ollama                   |
| ----------- | ----------------------- | ------------------------ |
| Cost        | Free (currently broken) | Free                     |
| Speed       | Fast (remote)           | Slower (local inference) |
| Reliability | Dependent on GitHub     | Full control             |
| Accuracy    | GPT-4 level             | Good (Mistral 7B)        |
| Setup       | Minimal                 | Docker service           |

The workflow will run **5-10x slower** (1-2 min vs 10-20 sec), but you eliminate API dependency and costs entirely.

**Want me to create a PR with these changes?**
