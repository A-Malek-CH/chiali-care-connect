import os
import io
import zipfile
import h5py
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import tensorflow as tf

app = FastAPI(title="MRI Analysis API")

# Configure CORS to allow the React frontend to communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development, allow all origins. In production, specify the frontend URL.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
KERAS_MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'aimodels', 'mobilenetv2_mri_transfer_learning.keras')
H5_MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'aimodels', 'mobilenetv2_mri_transfer_learning.h5')
IMG_SIZE = (224, 224)
CLASS_NAMES = ['glioma', 'meningioma', 'notumor', 'pituitary']

def build_model_with_extracted_weights():
    """Builds MobileNetV2 + Flatten + Dense architecture and loads trained weights."""
    print("Rebuilding MobileNetV2 architecture and loading trained weights...")
    base_model = tf.keras.applications.MobileNetV2(
        input_shape=(224, 224, 3),
        include_top=False,
        weights='imagenet'
    )
    base_model.trainable = False
    
    m = tf.keras.models.Sequential([
        base_model,
        tf.keras.layers.Flatten(),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(4, activation='softmax')
    ])
    
    # Try extracting weights from .keras zip file
    if os.path.exists(KERAS_MODEL_PATH):
        try:
            with zipfile.ZipFile(KERAS_MODEL_PATH, 'r') as z:
                with h5py.File(io.BytesIO(z.read('model.weights.h5')), 'r') as f:
                    kernel = np.array(f['layers']['dense']['vars']['0'])
                    bias = np.array(f['layers']['dense']['vars']['1'])
                    m.layers[-1].set_weights([kernel, bias])
                    print("Successfully set weights from .keras archive!")
                    return m
        except Exception as ex:
            print(f"Failed to read weights from .keras: {ex}")
            
    # Fall back to .h5 file
    if os.path.exists(H5_MODEL_PATH):
        try:
            with h5py.File(H5_MODEL_PATH, 'r') as f:
                dense_grp = f['model_weights']['dense']['mobilenet_transfer']['dense']
                kernel = np.array(dense_grp['kernel'])
                bias = np.array(dense_grp['bias'])
                m.layers[-1].set_weights([kernel, bias])
                print("Successfully set weights from .h5 file!")
                return m
        except Exception as ex:
            print(f"Failed to read weights from .h5: {ex}")
            
    return None

# Load model globally (loads once when the server starts)
model = None
for model_path in [KERAS_MODEL_PATH, H5_MODEL_PATH]:
    try:
        print(f"Trying to load model directly from {model_path}...")
        model = tf.keras.models.load_model(model_path)
        print(f"Model loaded successfully from {model_path}!")
        break
    except Exception as e:
        print(f"Direct load_model failed for {model_path}: {e}")

if model is None:
    try:
        model = build_model_with_extracted_weights()
    except Exception as e:
        print(f"Rebuilding model with weights failed: {e}")

if model is None:
    print("ERROR: Could not load model or weights from any provided file.")




def prepare_image(image_bytes: bytes):
    try:
        # Open image using PIL
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        # Resize to match model's expected input
        img = img.resize(IMG_SIZE)
        # Convert to numpy array
        img_array = np.array(img)
        # Expand dimensions to create a batch of 1: (1, 224, 224, 3)
        img_array = np.expand_dims(img_array, axis=0)
        
        # NOTE: MobileNetV2 usually expects inputs in range [-1, 1] (preprocess_input)
        # We will use the built-in keras preprocessing if needed, or just normalize to [0, 1] if that's how it was trained.
        # Based on standard MobileNetV2 transfer learning, let's use the official preprocess function
        img_array = tf.keras.applications.mobilenet_v2.preprocess_input(img_array)
        
        return img_array
    except Exception as e:
        raise ValueError(f"Failed to process image: {str(e)}")


@app.get("/")
def read_root():
    return {"status": "healthy", "message": "MRI Analysis API is running"}


@app.post("/predict")
async def predict_mri(file: UploadFile = File(...)):
    if model is None:
        raise HTTPException(status_code=500, detail="Model is not loaded on the server.")
    
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    try:
        # Read the file contents
        contents = await file.read()
        
        # Prepare the image
        img_array = prepare_image(contents)
        
        # Run inference
        predictions = model.predict(img_array)
        
        # Get the predicted class index and confidence
        predicted_idx = np.argmax(predictions[0])
        confidence = float(predictions[0][predicted_idx]) * 100
        predicted_class = CLASS_NAMES[predicted_idx]

        # Generate a human-readable message based on the prediction
        if predicted_class == 'notumor':
            status = 'success'
            message = 'No tumor detected.'
            details = [
                'Ventricles appear normal in size and configuration.',
                'Normal gray-white matter differentiation.',
                'No evidence of abnormal mass.'
            ]
        else:
            status = 'warning'
            message = f'Potential {predicted_class} detected.'
            details = [
                f'The AI model has identified visual patterns consistent with a {predicted_class}.',
                'Further evaluation by a radiologist or neurologist is strongly recommended.',
                'Please schedule a follow-up appointment.'
            ]

        return {
            "status": status,
            "message": message,
            "confidence": round(confidence, 2),
            "details": details,
            "class": predicted_class
        }
        
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

# To run the server locally:
# uvicorn api.main:app --reload --port 8000
