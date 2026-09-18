import pytest
from fastapi.testclient import TestClient
from src.main import app
from src.core.database import get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.models.patient import Patient
import json

# Test database
TEST_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_database():
    # Create tables
    Patient.metadata.create_all(bind=engine)
    yield
    # Drop tables
    Patient.metadata.drop_all(bind=engine)

def test_health_check():
    """Test health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_get_quiz_questions():
    """Test getting quiz questions"""
    response = client.get("/quiz/questions")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "questions" in data

def test_patient_create():
    """Test creating a patient record"""
    patient_data = {
        "name": "Test Patient",
        "email": "test@example.com",
        "phone": "1234567890",
        "age": 30
    }
    response = client.post("/api/patients/", json=patient_data)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == patient_data["name"]
    assert data["email"] == patient_data["email"]

def test_patient_get_all():
    """Test getting all patients"""
    # Create a test patient first
    patient_data = {
        "name": "Test Patient",
        "email": "test@example.com",
        "phone": "1234567890",
        "age": 30
    }
    client.post("/api/patients/", json=patient_data)
    
    # Get all patients
    response = client.get("/api/patients/?admin_secret=admin123")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0

def test_patient_get_by_id():
    """Test getting a patient by ID"""
    # Create a test patient first
    patient_data = {
        "name": "Test Patient",
        "email": "test@example.com",
        "phone": "1234567890",
        "age": 30
    }
    create_response = client.post("/api/patients/", json=patient_data)
    patient_id = create_response.json()["id"]
    
    # Get patient by ID
    response = client.get(f"/api/patients/{patient_id}?admin_secret=admin123")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == patient_id
    assert data["email"] == patient_data["email"]

def test_patient_delete():
    """Test deleting a patient"""
    # Create a test patient first
    patient_data = {
        "name": "Test Patient",
        "email": "test@example.com",
        "phone": "1234567890",
        "age": 30
    }
    create_response = client.post("/api/patients/", json=patient_data)
    patient_id = create_response.json()["id"]
    
    # Delete patient
    response = client.delete(f"/api/patients/{patient_id}?admin_secret=admin123")
    assert response.status_code == 200
    
    # Verify deletion
    get_response = client.get(f"/api/patients/{patient_id}?admin_secret=admin123")
    assert get_response.status_code == 404

def test_patient_unauthorized():
    """Test unauthorized access to patient endpoints"""
    response = client.get("/api/patients/?admin_secret=wrong_secret")
    assert response.status_code == 403

def test_booking_create():
    """Test creating a booking"""
    booking_data = {
        "fullName": "Test User",
        "email": "test@example.com",
        "phone": "1234567890",
        "consultationType": "In-Clinic Visit",
        "preferredDate": "2026-12-01",
        "preferredTime": "10:00 AM",
        "concern": "Hair loss"
    }
    response = client.post("/api/patients/booking", json=booking_data)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"

def test_admin_panel():
    """Test admin panel route"""
    response = client.get("/admin")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
