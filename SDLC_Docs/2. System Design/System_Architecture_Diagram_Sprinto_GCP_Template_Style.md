# System Architecture Diagram (GCP Template Style)

This is the same Hirexit architecture represented in a Google Cloud template-style layout for Sprinto evidence, cross-checked against the sample image structure.

## Artifacts

- Mermaid source: `System_Architecture_Diagram_Sprinto_GCP_Template_Style.mmd`
- Upload-ready visual: `System_Architecture_Diagram_Sprinto_GCP_Template_Style.svg`

## Cross-Check Mapping (vs sample image)

- **End Users -> Client Device -> Internet chain**: Added to match sample left-side access flow.
- **Google Cloud Project -> Region -> Zone -> Subnets nesting**: Added as explicit boundary layers.
- **Gateway and network controls**: Internet Gateway, VPN/Private Gateway, and VPC Firewall block added.
- **Application Code block**: Mapped to Cloud Run-hosted Fastify API/WebSocket and frontend static serving.
- **Storage and platform controls**: Cloud Storage/Firebase bucket with Security Command Center and Logging/Monitoring links.
- **Delivery path**: Cloud Build -> Artifact Registry -> Cloud Run app flow retained.
- **System-specific integrations**: MongoDB multi-tenant data layer + AI/voice/messaging/Judge0 integrations retained.

## Accuracy Notes

- The `Zone` and `Subnets` blocks are a **logical network-security representation** for template alignment.
- The runtime remains the real implementation from code: **Cloud Run + Fastify + MongoDB tenant DB resolution + Firebase/GCS storage adapter**.

## Code References Used

- `backend/server.js`
- `backend/src/utils/clientDbUtils.js`
- `backend/src/utils/storageAdapter.js`
- `backend/src/utils/firebaseUtils.js`
- `backend/src/services/aiCalling/providers/index.js`
- `backend/src/routes/aiCallRoutes.js`
- `backend/src/routes/VirtualInterview/webrtcRoomRoutes.js`
- `backend/src/routes/codeJudgeRoutes/executionAdapterRoutes.js`
- `backend/src/loaders/whatsAppLoader.js`
- `backend/cloudbuild.yaml`
