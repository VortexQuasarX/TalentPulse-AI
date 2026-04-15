import json
from fastapi import WebSocket
from typing import Dict, Set


class ConnectionManager:
    """Manages WebSocket connections per interview room. Ported from hackathon/backend."""

    def __init__(self):
        self._rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, interview_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        if interview_id not in self._rooms:
            self._rooms[interview_id] = set()
        self._rooms[interview_id].add(websocket)

    def disconnect(self, interview_id: str, websocket: WebSocket) -> None:
        if interview_id in self._rooms:
            self._rooms[interview_id].discard(websocket)
            if not self._rooms[interview_id]:
                del self._rooms[interview_id]

    async def broadcast_to_interview(self, interview_id: str, data: dict) -> None:
        if interview_id not in self._rooms:
            return
        message = json.dumps(data)
        dead_connections = set()
        for ws in self._rooms[interview_id]:
            try:
                await ws.send_text(message)
            except Exception:
                dead_connections.add(ws)
        for ws in dead_connections:
            self._rooms[interview_id].discard(ws)

    def get_connection_count(self, interview_id: str) -> int:
        return len(self._rooms.get(interview_id, set()))

    def get_active_interviews(self) -> list[str]:
        return list(self._rooms.keys())


manager = ConnectionManager()
