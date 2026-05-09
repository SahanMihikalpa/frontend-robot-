# Frontend Implementation Plan

This document tracks the frontend work for `frontend-robot` against the documented backend API surface.

## Completed

- Create scaffold (Next.js + TypeScript)
- Add base styling and layout
- Add README and run instructions

## Frontend Build Plan

1. Authentication
	- Login
	- Register
	- Token storage and logout
	- Protected route handling

2. Student dashboard
	- Summary cards
	- Mastery overview
	- Next skill recommendation
	- Quick actions

3. Practice flow
	- Fetch next adaptive question
	- Show answer form and record interaction
	- Session summary modal

4. Skills and questions
	- List skills
	- Skill graph / prerequisites visualization
	- List questions
	- Question details page

5. Tutor and learning path
	- Tutor chat UI
	- Streaming tutor responses
	- Hints panel
	- Learning path / concept map view

6. Analytics and history
	- Session history
	- Skill mastery charts
	- Admin analytics dashboard

7. Multimodal features
	- Engagement analysis
	- Hardware status panels
	- Voice pipeline UI
	- Camera and microphone controls

8. Knowledge base
	- Upload curriculum documents
	- Query the knowledge base

9. API client integration
	- Central auth-aware client
	- Typed request/response models
	- WebSocket helpers
	- Error handling and loading states

10. Documentation maintenance
	- Update frontend docs after every major UI/API change
	- Keep API binding notes aligned with backend docs
	- Keep setup and run instructions current

## Validation

- Build must pass with `npm run build`
- Sample API calls must be verified against the running backend
- Docs must be updated whenever a page or API binding changes
