

# SANKALP

### Intelligent Governance & Adaptive Logistics Ecosystem

SANKALP is a data-driven governance intelligence platform designed to synchronize static government infrastructure with dynamic population behavior. It leverages predictive analytics, unsupervised machine learning, and physics-inspired models to optimize Aadhaar enrollment infrastructure, detect potential subsidy leakage, and understand migrant workforce movement patterns at scale.

The system transforms raw demographic and biometric datasets into actionable intelligence for policy planning, logistics optimization, and forensic risk assessment.

---

## Core Intelligence Modules

### 1. Demographic Intelligence (Migration Analysis)

Identifies population behavior patterns using **Bivariate Matrix Analysis**, distinguishing:

* Permanent family settlements
* Transient labor and industrial hubs

This is inferred using adult-to-child population ratios at district level.

---

### 2. Forensic Risk Audit (Fraud Detection)

Detects abnormal demographic update behavior using **Z-Score based anomaly detection**.

* Flags districts where demographic updates significantly exceed biometric authentications
* Highlights potential cases of “phantom citizens” or address manipulation

---

### 3. Logistics Optimization (Resource Allocation)

Optimizes Aadhaar enrollment kit allocation using a **modified Newtonian Gravity Model**.

* Calculates attraction forces between surplus and deficit districts
* Generates optimal hardware transfer routes while minimizing distance-based operational costs

---

## System Architecture

* **Backend:** Flask (Python)
* **Frontend:** High-performance JavaScript UI
* **Processing:** Large-scale CSV-based demographic pipelines
* **Output:** Interactive geospatial maps and statistical dashboards

---

## Technology Stack

**Backend**

* Python 3.x
* Flask

**Data Processing & ML**

* Pandas
* NumPy
* Scikit-learn (K-Means)
* SciPy (Z-Score)

**Frontend & Visualization**

* HTML5, CSS3 (Bootstrap 5)
* JavaScript (ES6+)
* Leaflet.js (Geospatial Mapping)
* Plotly.js (Statistical Charts)

**Geospatial Data**

* GeoJSON (Indian States & Districts)

---

## Data Directory Structure

The application requires the following directory structure inside the project root:

```
/project-root
  /data
    /aadhaar_enrolment
       ├── *.csv   (Columns: age_5_17, age_0_5, state, district)
    /aadhaar_biometric
       ├── *.csv   (Columns: bio_age_17_, state, district)
    /aadhaar_demographic
       ├── *.csv   (Columns: demo_age_17_, pincode, state, district)
    ├── processed_cache.pkl  (Auto-generated after first run)
```

**Note:**
The system includes:

* Garbage data cleaning routines
* Fuzzy string matching (`difflib`) to normalize inconsistent state and district names against official GeoJSON boundaries

---

## Installation & Setup

### Prerequisites

* Python 3.8+
* pip

---

### Step 1: Clone the Repository

Extract or clone the project into a local directory.

---

### Step 2: Create a Virtual Environment (Recommended)

**Windows**

```
python -m venv venv
venv\Scripts\activate
```

**macOS / Linux**

```
python3 -m venv venv
source venv/bin/activate
```

---

### Step 3: Install Dependencies

Create a `requirements.txt` file:

```
flask
pandas
numpy
requests
scikit-learn
scipy
```

Install:

```
pip install -r requirements.txt
```

---

### Step 4: Run the Application

```
python app.py
```

* On first run, GeoJSON data is downloaded and CSV files are processed
* A cached file (`processed_cache.pkl`) is generated for faster subsequent runs

---

### Step 5: Access the Dashboard

Open your browser and navigate to:

```
http://127.0.0.1:5000
```

---

## Algorithmic Implementation Details

### 1. Gravity Model (Logistics Optimization)

**Formula**

```
Score = (log(Surplus) × log(Deficit) × 1000) / Distance_Factor
```

**Purpose**

* Prioritizes high-impact surplus-to-deficit transfers
* Penalizes long-distance movements to reduce operational expenditure

---

### 2. K-Means Clustering (Demographic Behavior)

Districts are clustered using **adult_share vs child_share** into:

* **Cluster 0 (Blue):** High Family Density (Residential / Source Regions)
* **Cluster 1 (Green):** Balanced Demographics
* **Cluster 2 (Orange):** Transit Hubs
* **Cluster 3 (Red):** High Workforce Density (Industrial / Migrant Zones)

---

### 3. Z-Score Anomaly Detection (Forensic Risk)

* Applied on demographic update vs biometric usage ratios
* **Threshold:** Z-Score > 1.2

Districts crossing the threshold are marked as **High Risk**, indicating statistically significant deviation from normal enrollment behavior.

---

## Use Case

SANKALP is designed for:

* National identity infrastructure planning
* Policy simulation and governance analytics
* Migration-aware resource allocation
* Early warning systems for data misuse or subsidy leakage

---

## Important Note: Data Extraction Required

Before running the application, **you must extract the dataset files**.

If the `data/` directory contains a **WINRAR (.rar) archive**, follow these steps:

1. Navigate to the `data/` folder.
2. **Extract all files from the WINRAR archive into the same `data/` folder**.
3. Ensure that the extracted files preserve the required subdirectory structure:

   * `aadhaar_enrolment/`
   * `aadhaar_biometric/`
   * `aadhaar_demographic/`

The application **will not run correctly** if the CSV files remain compressed inside the archive.
All datasets must be directly accessible as `.csv` files within their respective folders before starting the Flask server.

After extraction, proceed to run the application normally.
