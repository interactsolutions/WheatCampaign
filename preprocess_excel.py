import pandas as pd
import json
import warnings
from datetime import datetime
warnings.filterwarnings('ignore')

def convert_dms_to_decimal(dms_string):
    """
    Convert DMS (Degrees, Minutes, Seconds) to decimal degrees
    Example: "28°09'13.2\"N 69°48'59.7\"E" -> (28.153666666666667, 69.81658333333333)
    """
    try:
        if not dms_string or pd.isna(dms_string):
            return None, None
        
        # Clean the string
        dms_string = str(dms_string).replace('"', '').replace("'", "")
        
        # Split by space
        parts = dms_string.split()
        if len(parts) < 2:
            return None, None
        
        lat_str = parts[0]
        lon_str = parts[1]
        
        # Parse latitude
        lat_parts = lat_str.replace('°', ' ').replace('N', '').replace('S', '').split()
        lat_deg = float(lat_parts[0])
        lat_min = float(lat_parts[1]) if len(lat_parts) > 1 else 0
        lat_sec = float(lat_parts[2]) if len(lat_parts) > 2 else 0
        
        lat_dec = lat_deg + lat_min/60 + lat_sec/3600
        if 'S' in lat_str:
            lat_dec = -lat_dec
        
        # Parse longitude
        lon_parts = lon_str.replace('°', ' ').replace('E', '').replace('W', '').split()
        lon_deg = float(lon_parts[0])
        lon_min = float(lon_parts[1]) if len(lon_parts) > 1 else 0
        lon_sec = float(lon_parts[2]) if len(lon_parts) > 2 else 0
        
        lon_dec = lon_deg + lon_min/60 + lon_sec/3600
        if 'W' in lon_str:
            lon_dec = -lon_dec
        
        return lat_dec, lon_dec
    
    except Exception as e:
        print(f"Error converting {dms_string}: {str(e)}")
        return None, None

def process_excel_to_json(excel_file, output_file='sessions.json'):
    """
    Process the complex Excel file and create a clean sessions.json
    """
    print("Processing Excel file...")
    
    # Read the SUM sheet which contains the main data
    try:
        # Try different strategies to read the file
        df = pd.read_excel(excel_file, sheet_name='SUM')
        
        # Clean the dataframe
        # Remove empty rows and columns
        df = df.dropna(how='all', axis=0)
        df = df.dropna(how='all', axis=1)
        
        # Reset index
        df = df.reset_index(drop=True)
        
        # Find the header row (look for row containing 'SN' or 'S.N')
        header_row = None
        for i in range(min(10, len(df))):
            row_values = df.iloc[i].astype(str).str.lower().tolist()
            if any('sn' in str(val).lower() for val in row_values) or \
               any('s.n' in str(val).lower() for val in row_values):
                header_row = i
                break
        
        if header_row is None:
            # Use first row as header
            header_row = 0
        
        # Use the found header row
        df.columns = df.iloc[header_row]
        df = df.iloc[header_row + 1:].reset_index(drop=True)
        
        # Clean column names
        df.columns = [str(col).strip() for col in df.columns]
        
    except Exception as e:
        print(f"Error reading SUM sheet: {str(e)}")
        # Try reading without sheet name
        df = pd.read_excel(excel_file)
        df = df.dropna(how='all', axis=0)
        df = df.dropna(how='all', axis=1)
        df = df.reset_index(drop=True)
    
    # Map column names to our expected format
    column_mapping = {
        'S.N': 'sn',
        'SN': 'sn',
        'S.N.': 'sn',
        'City': 'city',
        'Session Location': 'spot',
        'Date': 'date',
        'Total Farmers': 'farmers',
        'Total Wheat Farmers': 'farmers',
        'Total Wheat Acres': 'acres',
        'Know Buctril': 'awareness',
        'Will Definitely Use': 'definite',
        'Maybe': 'maybe',
        'Not Interested': 'notInterested',
        'Top reason to use': 'reasonsUse',
        'Top reason not to use': 'reasonsNo',
        'Spot Coordinates': 'coordinates'
    }
    
    # Rename columns
    for old_col, new_col in column_mapping.items():
        if old_col in df.columns:
            df.rename(columns={old_col: new_col}, inplace=True)
    
    # Ensure required columns exist
    required_cols = ['sn', 'city', 'spot', 'date', 'farmers', 'acres', 'definite', 'maybe', 'notInterested']
    
    sessions = []
    
    for idx, row in df.iterrows():
        try:
            # Skip empty rows
            if pd.isna(row.get('city')) and pd.isna(row.get('spot')):
                continue
            
            # Convert coordinates
            lat, lon = None, None
            if 'coordinates' in row and not pd.isna(row['coordinates']):
                lat, lon = convert_dms_to_decimal(row['coordinates'])
            
            # Calculate percentages
            farmers = float(row.get('farmers', 0))
            definite = float(row.get('definite', 0))
            awareness = float(row.get('awareness', 0))
            
            definite_pct = (definite / farmers * 100) if farmers > 0 else 0
            awareness_pct = (awareness / farmers * 100) if farmers > 0 else 0
            clarity_pct = 60.0  # Default value from your data
            
            session = {
                'sn': int(row.get('sn', idx + 1)) if not pd.isna(row.get('sn')) else idx + 1,
                'city': str(row.get('city', '')).strip(),
                'spot': str(row.get('spot', '')).strip(),
                'date': str(row.get('date', '')).split()[0] if not pd.isna(row.get('date')) else '',
                'farmers': float(row.get('farmers', 0)),
                'acres': float(row.get('acres', 0)),
                'definite': float(row.get('definite', 0)),
                'maybe': float(row.get('maybe', 0)),
                'notInterested': float(row.get('notInterested', 0)),
                'definitePct': definite_pct,
                'awarenessPct': awareness_pct,
                'clarityPct': clarity_pct,
                'lat': lat,
                'lon': lon,
                'lng': lon,
                'longitude': lon,
                'latitude': lat,
                'reasonsUse': str(row.get('reasonsUse', '')).strip(),
                'reasonsNo': str(row.get('reasonsNo', '')).strip()
            }
            
            sessions.append(session)
            
        except Exception as e:
            print(f"Error processing row {idx}: {str(e)}")
            continue
    
    # Create the final JSON structure
    output_data = {
        'format': 'sessions_v1',
        'generatedAt': datetime.now().isoformat(),
        'sessions': sessions
    }
    
    # Write to JSON file
    with open(output_file, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"Successfully processed {len(sessions)} sessions")
    print(f"Output saved to {output_file}")
    
    return output_data

def extract_summary_data(excel_file):
    """
    Extract summary data from Overall Activation Summary sheet
    """
    try:
        summary_df = pd.read_excel(excel_file, sheet_name='Overall Activation Summary', header=None)
        
        summary = {}
        # Extract key summary values
        summary_cells = {
            'Total Sessions': (1, 1),  # Row, Col (0-indexed)
            'Total Farmers': (2, 1),
            'Total Wheat Acres': (3, 1),
            'Farmers Knowing Buctril': (4, 1),
            'Farmers Will Definitely Use': (5, 1)
        }
        
        for key, (row, col) in summary_cells.items():
            try:
                summary[key] = summary_df.iloc[row, col]
            except:
                summary[key] = 0
        
        return summary
        
    except Exception as e:
        print(f"Error extracting summary: {str(e)}")
        return {}

if __name__ == "__main__":
    # Process the Excel file
    excel_file = "Buctril_Super_Activations.xlsx"
    output_file = "sessions.json"
    
    try:
        data = process_excel_to_json(excel_file, output_file)
        
        # Also extract summary data
        summary = extract_summary_data(excel_file)
        print("\nSummary Data:")
        for key, value in summary.items():
            print(f"{key}: {value}")
            
    except Exception as e:
        print(f"Error: {str(e)}")
        print("\nAlternative: Create a simple sessions.json manually")
        
        # Create a minimal valid sessions.json
        minimal_data = {
            "format": "sessions_v1",
            "generatedAt": datetime.now().isoformat(),
            "sessions": [
                {
                    "sn": 1,
                    "city": "Sample City",
                    "spot": "Sample Spot",
                    "date": "2025-01-01",
                    "farmers": 50.0,
                    "acres": 1000.0,
                    "definite": 40.0,
                    "maybe": 8.0,
                    "notInterested": 2.0,
                    "definitePct": 80.0,
                    "awarenessPct": 70.0,
                    "clarityPct": 60.0,
                    "lat": 30.3753,
                    "lon": 69.3451,
                    "lng": 69.3451,
                    "longitude": 69.3451,
                    "latitude": 30.3753,
                    "reasonsUse": "Sample reason to use",
                    "reasonsNo": ""
                }
            ]
        }
        
        with open(output_file, 'w') as f:
            json.dump(minimal_data, f, indent=2)
        
        print(f"Created minimal {output_file} with sample data")
