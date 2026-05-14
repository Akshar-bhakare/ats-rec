# System Architecture Diagram (Sprinto Evidence)

Generated from current repository implementation on 2026-03-12.

## Diagram (Mermaid)

```mermaid
flowchart LR
    %% Actors
    U[Internal Users<br/>Ultra Admin, Client Admin, Recruiter, Interviewer]
    W[Candidates (Web UI)<br/>Interview links, candidate portal]
    P[Candidates (Phone/WhatsApp)]

    %% Runtime boundary
    subgraph CR["GCP Cloud Run Service (Dockerized Node.js Backend)"]
        FE[React + Vite Frontend<br/>Served as static assets (/static)]
        API[Fastify API + WebSocket Gateway<br/>JWT Auth, CSRF, RBAC, Tenant DB resolution]
        MOD[Core Modules<br/>ATS CRUD, AI Calling, Virtual Interview, Notifications,<br/>Email templates, Dashboard, Relevancy, Code Judge routes]
        SCH[Background Schedulers<br/>Periodic interview/call checks]

        FE <-->|HTTPS /api, ws/wss| API
        API --> MOD
        API --> SCH
    end

    %% Data layer
    MDB[(MongoDB<br/>DEFAULT_DB + per-tenant DBs)]
    STO[(Firebase Storage / GCS Adapter<br/>Audio, resumes, recordings)]
    TMP[(Ephemeral Temp Media<br/>AiSelektTmpMedia)]

    %% External integrations
    LLM[OpenAI / Gemini / Claude]
    STT[Deepgram + Google STT/TTS]
    TEL[Plivo / Telnyx (voice + media streams)]
    WA[WhatsApp Cloud API]
    EM[Email Providers<br/>Gmail OAuth2 / SMTP]
    J0[Judge0 CE Executor]
    MAPS[Google Maps APIs (places autocomplete)]

    %% CI/CD
    CB[Cloud Build]
    AR[Artifact Registry]

    %% Flows
    U <--> FE
    W <--> FE
    W <--> API
    P <--> TEL
    P <--> WA

    API <--> MDB
    API <--> STO
    API --> TMP

    API <--> LLM
    API <--> STT
    API <--> TEL
    API <--> WA
    API <--> EM
    API <--> J0
    FE --> MAPS

    CB --> AR --> API
```

## Code Evidence Used

- `backend/server.js`
- `backend/src/utils/clientDbUtils.js`
- `backend/src/utils/storageAdapter.js`
- `backend/src/utils/firebaseUtils.js`
- `backend/src/services/aiCalling/providers/index.js`
- `backend/src/services/aiCalling/providers/plivoProvider.js`
- `backend/src/services/aiCalling/providers/telnyxProvider.js`
- `backend/src/routes/aiCallRoutes.js`
- `backend/src/routes/VirtualInterview/webrtcRoomRoutes.js`
- `backend/src/routes/codeJudgeRoutes/executionAdapterRoutes.js`
- `backend/src/loaders/whatsAppLoader.js`
- `backend/cloudbuild.yaml`
