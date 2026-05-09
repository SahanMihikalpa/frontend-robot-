# API Binding Plan

This document maps the documented backend APIs to the frontend surfaces that should consume them.

## Authentication

- `POST /api/v1/auth/register` - register page
- `POST /api/v1/auth/login` - login page
- `GET /api/v1/auth/me` - auth initializer, profile menu, dashboard identity card

## Skills

- `GET /api/v1/skills/` - skills list page, admin management pages
- `POST /api/v1/skills/` - skill create form
- `GET /api/v1/skills/{id}` - skill detail view
- `PUT /api/v1/skills/{id}` - skill edit form
- `DELETE /api/v1/skills/{id}` - skill delete action
- `GET /api/v1/skills/graph` - concept map and prerequisite graph

## Questions

- `GET /api/v1/questions/` - practice selection, questions list page
- `POST /api/v1/questions/` - question create form
- `GET /api/v1/questions/{id}` - question detail view
- `PUT /api/v1/questions/{id}` - question edit form
- `DELETE /api/v1/questions/{id}` - question delete action

## Interactions

- `POST /api/v1/interactions/` - practice submission flow
- `GET /api/v1/interactions/me` - session history and dashboard activity
- `GET /api/v1/interactions/{id}` - interaction detail view

## DKT

- `GET /api/v1/dkt/next-question` - adaptive practice screen
- `GET /api/v1/dkt/predictions` - mastery panels and charts
- `GET /api/v1/dkt/knowledge-state` - dashboard analytics and diagnostics
- `POST /api/v1/dkt/train` - admin training controls

## BKT

- `GET /api/v1/bkt/state/{user_id}` - mastery progress page and dashboard widgets
- `GET /api/v1/bkt/state/{user_id}/{skill_id}` - skill drill-down panel
- `GET /api/v1/bkt/parameters/{skill_id}` - admin model settings page
- `PUT /api/v1/bkt/parameters/{skill_id}` - admin model settings form
- `POST /api/v1/bkt/fit-parameters` - admin training trigger

## Mastery

- `GET /api/v1/mastery/progress/{user_id}` - learning path and mastery overview
- `GET /api/v1/mastery/concept-map/{user_id}` - concept map visualization
- `GET /api/v1/mastery/summary/{user_id}` - dashboard stats cards
- `GET /api/v1/mastery/next/{user_id}` - next skill recommendation card
- `GET /api/v1/mastery/unlocked/{user_id}` - unlocked skills list
- `POST /api/v1/mastery/reset/{user_id}/{skill_id}` - admin reset control

## Tutor

- `POST /api/v1/tutor/ask` - tutor chat form submission
- `WS /api/v1/tutor/ask/stream` - streaming tutor chat UI
- `GET /api/v1/tutor/progress` - tutor progress summary
- `GET /api/v1/tutor/learning-path/{user_id}` - learning path page
- `POST /api/v1/tutor/hints` - practice hints panel
- `POST /api/v1/tutor/transcribe` - voice input transcription flow

## Engagement

- `POST /api/v1/engagement/analyze-visual` - webcam engagement pipeline
- `POST /api/v1/engagement/analyze-audio` - audio engagement pipeline
- `GET /api/v1/engagement/summary/{user_id}` - engagement summary cards
- `GET /api/v1/engagement/session/{session_id}` - session detail page

## Hardware

- `GET /api/v1/hardware/status` - hardware status panel
- `POST /api/v1/hardware/camera/start` - camera control UI
- `POST /api/v1/hardware/camera/stop` - camera control UI
- `GET /api/v1/hardware/camera/snapshot` - live preview / debug panel
- `GET /api/v1/hardware/camera/status` - camera status badge
- `POST /api/v1/hardware/microphone/start` - mic control UI
- `POST /api/v1/hardware/microphone/stop` - mic control UI
- `GET /api/v1/hardware/microphone/status` - mic status badge

## Voice Pipeline

- `WS /api/v1/voice/ws/{session_id}` - full voice tutor experience

## Knowledge Base

- `POST /api/v1/knowledge/upload` - document upload form
- `POST /api/v1/knowledge/query` - knowledge search interface
- `DELETE /api/v1/knowledge/{entry_id}` - admin cleanup

## Analytics

- `GET /api/v1/analytics/students` - admin analytics dashboard
- `GET /api/v1/analytics/student/{user_id}` - student drill-down page
- `GET /api/v1/analytics/skills` - class-wide skill analytics view

## Frontend Implementation Order

1. Auth and session handling.
2. Mastery dashboard and concept map.
3. Practice flow with questions and interactions.
4. Tutor chat and hints.
5. Learning path and history.
6. Engagement, hardware, and voice support.
7. Knowledge base and analytics pages.
8. Admin CRUD pages for skills and questions.
