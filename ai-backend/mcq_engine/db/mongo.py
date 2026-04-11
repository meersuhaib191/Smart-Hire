from __future__ import annotations

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.database import Database

from ..config import settings

_client: MongoClient | None = None


def get_mongo_client() -> MongoClient:
    global _client
    if _client is None:
        if settings.use_in_memory_store:
            import mongomock

            _client = mongomock.MongoClient()  # type: ignore[assignment]
        else:
            _client = MongoClient(settings.mongo_uri, maxPoolSize=100)
    return _client


def get_database() -> Database:
    return get_mongo_client()[settings.mongo_db_name]


def questions_collection() -> Collection:
    collection = get_database()["questions"]
    collection.create_index([("job_id", ASCENDING), ("company_tier", ASCENDING), ("topic", ASCENDING), ("difficulty", ASCENDING)])
    collection.create_index([("hash_id", ASCENDING)], unique=True)
    collection.create_index([("created_at", DESCENDING)])
    return collection


def question_sets_collection() -> Collection:
    collection = get_database()["question_sets"]
    collection.create_index([("job_id", ASCENDING), ("candidate_id", ASCENDING), ("created_at", DESCENDING)])
    collection.create_index([("job_id", ASCENDING), ("created_at", DESCENDING)])
    collection.create_index([("test_id", ASCENDING)], unique=True)
    return collection

