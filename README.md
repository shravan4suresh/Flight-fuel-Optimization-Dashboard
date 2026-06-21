# Flight Fuel Optimization Dashboard

This project is a static GitHub Pages dashboard for an academic machine learning use case:

**Flight Fuel Optimization using Machine Learning**

The dashboard predicts taxi-out / pushback delay patterns and estimates extra fuel burn, cost impact, and CO2 emissions using synthetic aviation operations data.

## Dashboard Sections

- Overview
- Taxi-Out Time Analysis
- Weather & Congestion Impact
- Fuel Burn Estimation
- CO2 Impact
- ML Prediction Results
- Scenario Analysis

## Files

```text
flight-fuel-optimization-dashboard/
├── index.html
├── style.css
├── app.js
├── README.md
└── data/
    └── sample_flight_data.csv
```

## Dataset Features

The sample CSV includes:

- `flight_date`
- `departure_airport`
- `airline`
- `aircraft_type`
- `gate`
- `runway`
- `scheduled_departure_time`
- `actual_pushback_time`
- `taxi_out_time_minutes`
- `departure_delay_minutes`
- `wind_speed`
- `visibility`
- `weather_condition`
- `airport_congestion_level`
- `fuel_burn_rate_kg_per_minute`
- `estimated_extra_fuel_kg`
- `estimated_co2_kg`

## Charts

- Average taxi-out time trend
- Taxi delay by airport/runway
- Weather impact on taxi time
- Congestion vs fuel burn
- Estimated fuel saving
- CO2 saving estimate
- Predicted vs actual taxi-out time

## Methodology

The dashboard uses synthetic data designed to resemble airport surface operations. Taxi-out time rises with congestion, lower visibility, adverse weather, wind, runway effects, and departure delay. Extra fuel burn is estimated as:

```text
max(taxi_out_time_minutes - 14, 0) * fuel_burn_rate_kg_per_minute
```

CO2 emissions are estimated with:

```text
estimated_extra_fuel_kg * 3.16
```

The ML prediction chart uses a transparent JavaScript scoring function to emulate regression model output. For a full academic submission, this can be replaced with predictions exported from Python, R, or notebook-based training workflows.

## Run Locally

Because the dashboard fetches a CSV file, run it from a local static server:

```bash
cd flight-fuel-optimization-dashboard
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000
```

## Deploy on GitHub Pages

1. Push this folder to a GitHub repository.
2. In repository settings, open **Pages**.
3. Select the branch that contains the dashboard.
4. Set the Pages source to the repository root or this project folder, depending on repository layout.
5. Save and open the generated GitHub Pages URL.

No build step is required.
