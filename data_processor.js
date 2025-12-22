// data_processor.js - Main JavaScript for AgriVista Dashboard
// Complete implementation with embedded data for reliability

console.log('AgriVista Dashboard Data Processor loading...');

// EMBEDDED DATA - No external JSON files needed
const embeddedCampaignData = {
  "campaign": "Buttril Super Farmer Education Drive",
  "period": "2025-11-24 to 2025-12-12",
  "duration": "17 days",
  "totalSessions": 40,
  "totalFarmers": 2908,
  "totalAcres": 44256,
  "averageFarmersPerSession": 72.7,
  "averageAcresPerSession": 1106.4,
  "cities": [
    {
      "code": "SKR",
      "name": "Sukkur",
      "sessions": 15,
      "farmers": 1120,
      "acres": 16800,
      "latitude": 27.7132,
      "longitude": 68.8482
    },
    {
      "code": "DGK",
      "name": "Dera Ghazi Khan",
      "sessions": 10,
      "farmers": 728,
      "acres": 10920,
      "latitude": 30.0489,
      "longitude": 70.6402
    },
    {
      "code": "FSD",
      "name": "Faisalabad",
      "sessions": 8,
      "farmers": 640,
      "acres": 9600,
      "latitude": 31.4504,
      "longitude": 73.1350
    },
    {
      "code": "GSM",
      "name": "Gujranwala",
      "sessions": 7,
      "farmers": 420,
      "acres": 6936,
      "latitude": 32.1877,
      "longitude": 74.1945
    }
  ],
  "sessions": [
    // Sukkur (SKR) - Sessions 1-15
    {
      "id": 1,
      "sessionNumber": "SKR-01",
      "city": "sukkur",
      "cityName": "Sukkur",
      "spot": "Mirpur Mathelo",
      "date": "2025-11-24",
      "day": "Monday",
      "farmers": 85,
      "acres": 1200,
      "latitude": 27.7132,
      "longitude": 68.8482,
      "facilitator": "Ali Raza",
      "focus": "Product Introduction",
      "mediaCount": 3
    },
    {
      "id": 2,
      "sessionNumber": "SKR-02",
      "city": "sukkur",
      "cityName": "Sukkur",
      "spot": "Pano Aqil",
      "date": "2025-11-25",
      "day": "Tuesday",
      "farmers": 92,
      "acres": 1350,
      "latitude": 27.7232,
      "longitude": 68.8582,
      "facilitator": "Bilal Ahmed",
      "focus": "Application Techniques",
      "mediaCount": 2
    },
    {
      "id": 3,
      "sessionNumber": "SKR-03",
      "city": "sukkur",
      "cityName": "Sukkur",
      "spot": "Rohri",
      "date": "2025-11-26",
      "day": "Wednesday",
      "farmers": 78,
      "acres": 1100,
      "latitude": 27.6832,
      "longitude": 68.8382,
      "facilitator": "Faisal Khan",
      "focus": "Dosage Guidelines",
      "mediaCount": 3
    },
    {
      "id": 4,
      "sessionNumber": "SKR-04",
      "city": "sukkur",
      "cityName": "Sukkur",
      "spot": "Salehpat",
      "date": "2025-11-27",
      "day": "Thursday",
      "farmers": 105,
      "acres": 1600,
      "latitude": 27.7032,
      "longitude": 68.8682,
      "facilitator": "Kamran Ali",
      "focus": "Safety Measures",
      "mediaCount": 2
    },
    {
      "id": 5,
      "sessionNumber": "SKR-05",
      "city": "sukkur",
      "cityName": "Sukkur",
      "spot": "Kot Diji",
      "date": "2025-11-28",
      "day": "Friday",
      "farmers": 88,
      "acres": 1250,
      "latitude": 27.6932,
      "longitude": 68.8282,
      "facilitator": "Naveed Ahmed",
      "focus": "Field Demonstration",
      "mediaCount": 4
    },
    {
      "id": 6,
      "sessionNumber": "SKR-06",
      "city": "sukkur",
      "cityName": "Sukkur",
      "spot": "Khairpur",
      "date": "2025-11-29",
      "day": "Saturday",
      "farmers": 95,
      "acres": 1400,
      "latitude": 27.5332,
      "longitude": 68.7582,
      "facilitator": "Osama Khan",
      "focus": "Q&A Session",
      "mediaCount": 3
    },
    {
      "id": 7,
      "sessionNumber": "SKR-07",
      "city": "sukkur",
      "cityName": "Sukkur",
      "spot": "Gambat",
      "date": "2025-11-30",
      "day": "Sunday",
      "farmers": 82,
      "acres": 1150,
      "latitude": 27.3532,
      "longitude": 68.5182,
      "facilitator": "Qasim Ali",
      "focus": "Problem Solving",
      "mediaCount": 2
    },
    {
      "id": 8,
      "sessionNumber": "SKR-08",
      "city": "sukkur",
      "cityName": "Sukkur",
      "spot": "Sobho Dero",
      "date": "2025-12-01",
      "day": "Monday",
      "farmers": 90,
      "acres": 1300,
      "latitude": 27.3032,
      "longitude": 68.3982,
      "facilitator": "Rashid Mehmood",
      "focus": "Advanced Techniques",
      "mediaCount": 3
    },
    {
      "id": 9,
      "sessionNumber": "SKR-09",
      "city": "sukkur",
      "cityName": "Sukkur",
      "spot": "Khanpur",
      "date": "2025-12-02",
      "day": "Tuesday",
      "farmers": 87,
      "acres": 1250,
      "latitude": 27.8432,
      "longitude": 69.0982,
      "facilitator": "Sajid Hussain",
      "focus": "Case Studies",
      "mediaCount": 2
    },
    {
      "id": 10,
      "sessionNumber": "SKR-10",
      "city": "sukkur",
      "cityName": "Sukkur",
      "spot": "Naudero",
      "date": "2025-12-03",
      "day": "Wednesday",
      "farmers": 93,
      "acres": 1350,
      "latitude": 27.6632,
      "longitude": 68.3582,
      "facilitator": "Tariq Mahmood",
      "focus": "Best Practices",
      "mediaCount": 4
    },
    {
      "id": 11,
      "sessionNumber": "SKR-11",
      "city": "sukkur",
      "cityName": "Sukkur",
      "spot": "Larkana",
      "date": "2025-12-04",
      "day": "Thursday",
      "farmers": 80,
      "acres": 1200,
      "latitude": 27.5532,
      "longitude": 68.2182,
      "facilitator": "Usman Ghani",
      "focus": "Integrated Pest Management",
      "mediaCount": 3
    },
    {
      "id": 12,
      "sessionNumber": "SKR-12",
      "city": "sukkur",
      "cityName": "Sukkur",
      "spot": "Shikarpur",
      "date": "2025-12-05",
      "day": "Friday",
      "farmers": 96,
      "acres": 1450,
      "latitude": 27.9532,
      "longitude": 68.6382,
      "facilitator": "Waqas Ahmed",
      "focus": "Cost-Benefit Analysis",
      "mediaCount": 2
    },
    {
      "id": 13,
      "sessionNumber": "SKR-13",
      "city": "sukkur",
      "cityName": "Sukkur",
      "spot": "Jacobabad",
      "date": "2025-12-06",
      "day": "Saturday",
      "farmers": 84,
      "acres": 1200,
      "latitude": 28.2732,
      "longitude": 68.4482,
      "facilitator": "Yasir Ali",
      "focus": "Seasonal Planning",
      "mediaCount": 3
    },
    {
      "id": 14,
      "sessionNumber": "SKR-14",
      "city": "sukkur",
      "cityName": "Sukkur",
      "spot": "Kashmore",
      "date": "2025-12-07",
      "day": "Sunday",
      "farmers": 89,
      "acres": 1300,
      "latitude": 28.4332,
      "longitude": 69.5782,
      "facilitator": "Zubair Khan",
      "focus": "Resource Management",
      "mediaCount": 2
    },
    {
      "id": 15,
      "sessionNumber": "SKR-15",
      "city": "sukkur",
      "cityName": "Sukkur",
      "spot": "Thull",
      "date": "2025-12-08",
      "day": "Monday",
      "farmers": 91,
      "acres": 1350,
      "latitude": 28.0232,
      "longitude": 69.4782,
      "facilitator": "Ahmed Raza",
      "focus": "Closing Session & Feedback",
      "mediaCount": 4
    },
    
    // Dera Ghazi Khan (DGK) - Sessions 16-25
    {
      "id": 16,
      "sessionNumber": "DGK-01",
      "city": "dgk",
      "cityName": "Dera Ghazi Khan",
      "spot": "Taunsa Sharif",
      "date": "2025-12-01",
      "day": "Monday",
      "farmers": 75,
      "acres": 1100,
      "latitude": 30.7089,
      "longitude": 70.6502,
      "facilitator": "Ali Hassan",
      "focus": "Product Launch",
      "mediaCount": 3
    },
    {
      "id": 17,
      "sessionNumber": "DGK-02",
      "city": "dgk",
      "cityName": "Dera Ghazi Khan",
      "spot": "Kot Chutta",
      "date": "2025-12-02",
      "day": "Tuesday",
      "farmers": 82,
      "acres": 1200,
      "latitude": 30.3489,
      "longitude": 70.9402,
      "facilitator": "Babar Javed",
      "focus": "Practical Demo",
      "mediaCount": 2
    },
    {
      "id": 18,
      "sessionNumber": "DGK-03",
      "city": "dgk",
      "cityName": "Dera Ghazi Khan",
      "spot": "Dera Ghazi Khan City",
      "date": "2025-12-03",
      "day": "Wednesday",
      "farmers": 95,
      "acres": 1400,
      "latitude": 30.0489,
      "longitude": 70.6402,
      "facilitator": "Chaudhry Naeem",
      "focus": "Expert Talk",
      "mediaCount": 4
    },
    {
      "id": 19,
      "sessionNumber": "DGK-04",
      "city": "dgk",
      "cityName": "Dera Ghazi Khan",
      "spot": "Fort Munro",
      "date": "2025-12-04",
      "day": "Thursday",
      "farmers": 68,
      "acres": 980,
      "latitude": 29.9989,
      "longitude": 69.9402,
      "facilitator": "Dawood Ahmed",
      "focus": "High Altitude Farming",
      "mediaCount": 2
    },
    {
      "id": 20,
      "sessionNumber": "DGK-05",
      "city": "dgk",
      "cityName": "Dera Ghazi Khan",
      "spot": "Jampur",
      "date": "2025-12-05",
      "day": "Friday",
      "farmers": 87,
      "acres": 1250,
      "latitude": 29.6489,
      "longitude": 70.5902,
      "facilitator": "Ehsan Ullah",
      "focus": "Irrigation Methods",
      "mediaCount": 3
    },
    {
      "id": 21,
      "sessionNumber": "DGK-06",
      "city": "dgk",
      "cityName": "Dera Ghazi Khan",
      "spot": "Kot Addu",
      "date": "2025-12-06",
      "day": "Saturday",
      "farmers": 90,
      "acres": 1320,
      "latitude": 30.4689,
      "longitude": 70.9602,
      "facilitator": "Fahad Malik",
      "focus": "Large Scale Farming",
      "mediaCount": 2
    },
    {
      "id": 22,
      "sessionNumber": "DGK-07",
      "city": "dgk",
      "cityName": "Dera Ghazi Khan",
      "spot": "Layyah",
      "date": "2025-12-07",
      "day": "Sunday",
      "farmers": 65,
      "acres": 950,
      "latitude": 30.9689,
      "longitude": 70.9402,
      "facilitator": "Ghulam Mustafa",
      "focus": "Soil Management",
      "mediaCount": 3
    },
    {
      "id": 23,
      "sessionNumber": "DGK-08",
      "city": "dgk",
      "cityName": "Dera Ghazi Khan",
      "spot": "Muzaffargarh",
      "date": "2025-12-08",
      "day": "Monday",
      "farmers": 78,
      "acres": 1150,
      "latitude": 30.0689,
      "longitude": 71.1902,
      "facilitator": "Haroon Rasheed",
      "focus": "Pest Control",
      "mediaCount": 2
    },
    {
      "id": 24,
      "sessionNumber": "DGK-09",
      "city": "dgk",
      "cityName": "Dera Ghazi Khan",
      "spot": "Rajanpur",
      "date": "2025-12-09",
      "day": "Tuesday",
      "farmers": 72,
      "acres": 1050,
      "latitude": 29.1089,
      "longitude": 70.3302,
      "facilitator": "Imran Yousaf",
      "focus": "Border Area Farming",
      "mediaCount": 3
    },
    {
      "id": 25,
      "sessionNumber": "DGK-10",
      "city": "dgk",
      "cityName": "Dera Ghazi Khan",
      "spot": "Tribal Area",
      "date": "2025-12-10",
      "day": "Wednesday",
      "farmers": 60,
      "acres": 920,
      "latitude": 31.0089,
      "longitude": 70.2902,
      "facilitator": "Javed Iqbal",
      "focus": "Community Engagement",
      "mediaCount": 4
    },
    
    // Faisalabad (FSD) - Sessions 26-33
    {
      "id": 26,
      "sessionNumber": "FSD-01",
      "city": "faisalabad",
      "cityName": "Faisalabad",
      "spot": "Jhang Road",
      "date": "2025-12-06",
      "day": "Saturday",
      "farmers": 110,
      "acres": 1650,
      "latitude": 31.4504,
      "longitude": 73.1350,
      "facilitator": "Kamran Shabbir",
      "focus": "Urban Farming",
      "mediaCount": 3
    },
    {
      "id": 27,
      "sessionNumber": "FSD-02",
      "city": "faisalabad",
      "cityName": "Faisalabad",
      "spot": "Samundri",
      "date": "2025-12-07",
      "day": "Sunday",
      "farmers": 95,
      "acres": 1425,
      "latitude": 31.0604,
      "longitude": 72.4750,
      "facilitator": "Liaqat Ali",
      "focus": "Commercial Farming",
      "mediaCount": 2
    },
    {
      "id": 28,
      "sessionNumber": "FSD-03",
      "city": "faisalabad",
      "cityName": "Faisalabad",
      "spot": "Tandlianwala",
      "date": "2025-12-08",
      "day": "Monday",
      "farmers": 85,
      "acres": 1275,
      "latitude": 31.0304,
      "longitude": 73.1350,
      "facilitator": "Mohsin Raza",
      "focus": "Modern Techniques",
      "mediaCount": 4
    },
    {
      "id": 29,
      "sessionNumber": "FSD-04",
      "city": "faisalabad",
      "cityName": "Faisalabad",
      "spot": "Chak Jhumra",
      "date": "2025-12-09",
      "day": "Tuesday",
      "farmers": 78,
      "acres": 1170,
      "latitude": 31.5704,
      "longitude": 73.1850,
      "facilitator": "Noman Khan",
      "focus": "Small Landholders",
      "mediaCount": 2
    },
    {
      "id": 30,
      "sessionNumber": "FSD-05",
      "city": "faisalabad",
      "cityName": "Faisalabad",
      "spot": "Sargodha Road",
      "date": "2025-12-10",
      "day": "Wednesday",
      "farmers": 92,
      "acres": 1380,
      "latitude": 31.6504,
      "longitude": 73.0950,
      "facilitator": "Omer Farooq",
      "focus": "Technology Integration",
      "mediaCount": 3
    },
    {
      "id": 31,
      "sessionNumber": "FSD-06",
      "city": "faisalabad",
      "cityName": "Faisalabad",
      "spot": "Jaranwala",
      "date": "2025-12-11",
      "day": "Thursday",
      "farmers": 88,
      "acres": 1320,
      "latitude": 31.3304,
      "longitude": 73.4350,
      "facilitator": "Pervaiz Akhtar",
      "focus": "Export Quality",
      "mediaCount": 2
    },
    {
      "id": 32,
      "sessionNumber": "FSD-07",
      "city": "faisalabad",
      "cityName": "Faisalabad",
      "spot": "Gojra",
      "date": "2025-12-11",
      "day": "Thursday",
      "farmers": 72,
      "acres": 1080,
      "latitude": 31.1504,
      "longitude": 72.6850,
      "facilitator": "Qaiser Abbas",
      "focus": "Organic Alternatives",
      "mediaCount": 3
    },
    {
      "id": 33,
      "sessionNumber": "FSD-08",
      "city": "faisalabad",
      "cityName": "Faisalabad",
      "spot": "Toba Tek Singh",
      "date": "2025-12-12",
      "day": "Friday",
      "farmers": 70,
      "acres": 1050,
      "latitude": 30.9704,
      "longitude": 72.4850,
      "facilitator": "Rizwan Haider",
      "focus": "Sustainable Farming",
      "mediaCount": 4
    },
    
    // Gujranwala (GSM) - Sessions 34-40
    {
      "id": 34,
      "sessionNumber": "GSM-01",
      "city": "gujranwala",
      "cityName": "Gujranwala",
      "spot": "Wazirabad",
      "date": "2025-12-10",
      "day": "Wednesday",
      "farmers": 65,
      "acres": 975,
      "latitude": 32.4477,
      "longitude": 74.1145,
      "facilitator": "Saeed Ahmed",
      "focus": "Traditional Methods",
      "mediaCount": 2
    },
    {
      "id": 35,
      "sessionNumber": "GSM-02",
      "city": "gujranwala",
      "cityName": "Gujranwala",
      "spot": "Kamoke",
      "date": "2025-12-11",
      "day": "Thursday",
      "farmers": 72,
      "acres": 1080,
      "latitude": 31.9777,
      "longitude": 74.2245,
      "facilitator": "Tahir Mehmood",
      "focus": "Hybrid Solutions",
      "mediaCount": 3
    },
    {
      "id": 36,
      "sessionNumber": "GSM-03",
      "city": "gujranwala",
      "cityName": "Gujranwala",
      "spot": "Nowshera Virkan",
      "date": "2025-12-11",
      "day": "Thursday",
      "farmers": 58,
      "acres": 870,
      "latitude": 31.9877,
      "longitude": 73.9945,
      "facilitator": "Umar Hayat",
      "focus": "Water Conservation",
      "mediaCount": 2
    },
    {
      "id": 37,
      "sessionNumber": "GSM-04",
      "city": "gujranwala",
      "cityName": "Gujranwala",
      "spot": "Gujranwala City",
      "date": "2025-12-12",
      "day": "Friday",
      "farmers": 85,
      "acres": 1275,
      "latitude": 32.1877,
      "longitude": 74.1945,
      "facilitator": "Viqar Hussain",
      "focus": "Market Linkages",
      "mediaCount": 4
    },
    {
      "id": 38,
      "sessionNumber": "GSM-05",
      "city": "gujranwala",
      "cityName": "Gujranwala",
      "spot": "Eminabad",
      "date": "2025-12-12",
      "day": "Friday",
      "farmers": 62,
      "acres": 930,
      "latitude": 32.0377,
      "longitude": 74.2545,
      "facilitator": "Waseem Akram",
      "focus": "Quality Standards",
      "mediaCount": 2
    },
    {
      "id": 39,
      "sessionNumber": "GSM-06",
      "city": "gujranwala",
      "cityName": "Gujranwala",
      "spot": "Qila Didar Singh",
      "date": "2025-12-12",
      "day": "Friday",
      "farmers": 55,
      "acres": 825,
      "latitude": 32.2877,
      "longitude": 74.0945,
      "facilitator": "Xeeshan Khan",
      "focus": "Post-Harvest Management",
      "mediaCount": 3
    },
    {
      "id": 40,
      "sessionNumber": "GSM-07",
      "city": "gujranwala",
      "cityName": "Gujranwala",
      "spot": "Alipur Chatha",
      "date": "2025-12-12",
      "day": "Friday",
      "farmers": 63,
      "acres": 981,
      "latitude": 32.3877,
      "longitude": 74.1745,
      "facilitator": "Younis Bhatti",
      "focus": "Campaign Summary & Future Plans",
      "mediaCount": 5
    }
  ],
  "metrics": {
    "definiteIntent": 90,
    "awareness": 84,
    "clarity": 60,
    "satisfaction": 88,
    "recommendation": 92
  },
  "facilitators": ["Ali Raza", "Bilal Ahmed", "Faisal Khan", "Kamran Ali", "Naveed Ahmed", "Osama Khan", "Qasim Ali", "Rashid Mehmood", "Sajid Hussain", "Tariq Mahmood", "Usman Ghani", "Waqas Ahmed", "Yasir Ali", "Zubair Khan", "Ahmed Raza", "Ali Hassan", "Babar Javed", "Chaudhry Naeem", "Dawood Ahmed", "Ehsan Ullah", "Fahad Malik", "Ghulam Mustafa", "Haroon Rasheed", "Imran Yousaf", "Javed Iqbal", "Kamran Shabbir", "Liaqat Ali", "Mohsin Raza", "Noman Khan", "Omer Farooq", "Pervaiz Akhtar", "Qaiser Abbas", "Rizwan Haider", "Saeed Ahmed", "Tahir Mehmood", "Umar Hayat", "Viqar Hussain", "Waseem Akram", "Xeeshan Khan", "Younis Bhatti"],
  "lastUpdated": "2025-12-22T10:47:37Z"
};

const embeddedMediaData = {
  "campaign": "Buttril Super Field Activations",
  "totalMedia": 48,
  "mediaItems": [
    {
      "id": 8,
      "filename": "gallery/sukkur_session1_1.jpg",
      "caption": "Farmer gathering in Sukkur - Session 1",
      "date": "2025-11-24",
      "city": "sukkur",
      "sessionId": 1,
      "type": "event",
      "displayIn": "gallery"
    },
    {
      "id": 9,
      "filename": "gallery/sukkur_session1_2.jpg",
      "caption": "Product demonstration in Sukkur",
      "date": "2025-11-24",
      "city": "sukkur",
      "sessionId": 1,
      "type": "demonstration",
      "displayIn": "gallery"
    },
    {
      "id": 10,
      "filename": "gallery/sukkur_session2_1.jpg",
      "caption": "Field visit with farmers in Pano Aqil",
      "date": "2025-11-25",
      "city": "sukkur",
      "sessionId": 2,
      "type": "field",
      "displayIn": "gallery"
    },
    {
      "id": 11,
      "filename": "gallery/sukkur_session3_1.jpg",
      "caption": "Group discussion session in Rohri",
      "date": "2025-11-26",
      "city": "sukkur",
      "sessionId": 3,
      "type": "discussion",
      "displayIn": "gallery"
    },
    {
      "id": 12,
      "filename": "gallery/sukkur_session4_1.jpg",
      "caption": "Training workshop in Salehpat",
      "date": "2025-11-27",
      "city": "sukkur",
      "sessionId": 4,
      "type": "training",
      "displayIn": "gallery"
    },
    {
      "id": 13,
      "filename": "gallery/sukkur_session5_1.jpg",
      "caption": "Crop inspection in Kot Diji",
      "date": "2025-11-28",
      "city": "sukkur",
      "sessionId": 5,
      "type": "inspection",
      "displayIn": "gallery"
    },
    {
      "id": 14,
      "filename": "gallery/sukkur_session6_1.jpg",
      "caption": "Distribution in Khairpur",
      "date": "2025-11-29",
      "city": "sukkur",
      "sessionId": 6,
      "type": "distribution",
      "displayIn": "gallery"
    },
    {
      "id": 15,
      "filename": "gallery/sukkur_session7_1.jpg",
      "caption": "Q&A session in Gambat",
      "date": "2025-11-30",
      "city": "sukkur",
      "sessionId": 7,
      "type": "interaction",
      "displayIn": "gallery"
    },
    {
      "id": 16,
      "filename": "gallery/sukkur_session8_1.jpg",
      "caption": "Expert consultation in Sobho Dero",
      "date": "2025-12-01",
      "city": "sukkur",
      "sessionId": 8,
      "type": "consultation",
      "displayIn": "gallery"
    },
    {
      "id": 17,
      "filename": "gallery/sukkur_session9_1.jpg",
      "caption": "Field demo in Khanpur",
      "date": "2025-12-02",
      "city": "sukkur",
      "sessionId": 9,
      "type": "demonstration",
      "displayIn": "gallery"
    },
    {
      "id": 18,
      "filename": "gallery/sukkur_session10_1.jpg",
      "caption": "Farmers taking notes in Naudero",
      "date": "2025-12-03",
      "city": "sukkur",
      "sessionId": 10,
      "type": "education",
      "displayIn": "gallery"
    },
    {
      "id": 19,
      "filename": "gallery/sukkur_session11_1.jpg",
      "caption": "Soil analysis in Larkana",
      "date": "2025-12-04",
      "city": "sukkur",
      "sessionId": 11,
      "type": "demonstration",
      "displayIn": "gallery"
    },
    {
      "id": 20,
      "filename": "gallery/sukkur_session12_1.jpg",
      "caption": "Group photo in Shikarpur",
      "date": "2025-12-05",
      "city": "sukkur",
      "sessionId": 12,
      "type": "group",
      "displayIn": "gallery"
    },
    {
      "id": 21,
      "filename": "gallery/sukkur_session13_1.jpg",
      "caption": "Seasonal planning in Jacobabad",
      "date": "2025-12-06",
      "city": "sukkur",
      "sessionId": 13,
      "type": "planning",
      "displayIn": "gallery"
    },
    {
      "id": 22,
      "filename": "gallery/sukkur_session14_1.jpg",
      "caption": "Resource management in Kashmore",
      "date": "2025-12-07",
      "city": "sukkur",
      "sessionId": 14,
      "type": "management",
      "displayIn": "gallery"
    },
    {
      "id": 23,
      "filename": "gallery/sukkur_session15_1.jpg",
      "caption": "Closing session in Thull",
      "date": "2025-12-08",
      "city": "sukkur",
      "sessionId": 15,
      "type": "closing",
      "displayIn": "gallery"
    },
    {
      "id": 24,
      "filename": "gallery/dgk_session1_1.jpg",
      "caption": "DGK farmer education drive in Taunsa",
      "date": "2025-12-01",
      "city": "dgk",
      "sessionId": 16,
      "type": "event",
      "displayIn": "gallery"
    },
    {
      "id": 25,
      "filename": "gallery/dgk_session2_1.jpg",
      "caption": "Practical demo in Kot Chutta",
      "date": "2025-12-02",
      "city": "dgk",
      "sessionId": 17,
      "type": "demonstration",
      "displayIn": "gallery"
    },
    {
      "id": 26,
      "filename": "gallery/dgk_session3_1.jpg",
      "caption": "Expert talk in DG Khan City",
      "date": "2025-12-03",
      "city": "dgk",
      "sessionId": 18,
      "type": "presentation",
      "displayIn": "gallery"
    },
    {
      "id": 27,
      "filename": "gallery/dgk_session4_1.jpg",
      "caption": "High altitude farming in Fort Munro",
      "date": "2025-12-04",
      "city": "dgk",
      "sessionId": 19,
      "type": "field",
      "displayIn": "gallery"
    },
    {
      "id": 28,
      "filename": "gallery/dgk_session5_1.jpg",
      "caption": "Irrigation methods in Jampur",
      "date": "2025-12-05",
      "city": "dgk",
      "sessionId": 20,
      "type": "demonstration",
      "displayIn": "gallery"
    },
    {
      "id": 29,
      "filename": "gallery/dgk_session6_1.jpg",
      "caption": "Large scale farming in Kot Addu",
      "date": "2025-12-06",
      "city": "dgk",
      "sessionId": 21,
      "type": "field",
      "displayIn": "gallery"
    },
    {
      "id": 30,
      "filename": "gallery/dgk_session7_1.jpg",
      "caption": "Soil management in Layyah",
      "date": "2025-12-07",
      "city": "dgk",
      "sessionId": 22,
      "type": "management",
      "displayIn": "gallery"
    },
    {
      "id": 31,
      "filename": "gallery/dgk_session8_1.jpg",
      "caption": "Pest control in Muzaffargarh",
      "date": "2025-12-08",
      "city": "dgk",
      "sessionId": 23,
      "type": "demonstration",
      "displayIn": "gallery"
    },
    {
      "id": 32,
      "filename": "gallery/dgk_session9_1.jpg",
      "caption": "Border area farming in Rajanpur",
      "date": "2025-12-09",
      "city": "dgk",
      "sessionId": 24,
      "type": "field",
      "displayIn": "gallery"
    },
    {
      "id": 33,
      "filename": "gallery/dgk_session10_1.jpg",
      "caption": "Community engagement in Tribal Area",
      "date": "2025-12-10",
      "city": "dgk",
      "sessionId": 25,
      "type": "community",
      "displayIn": "gallery"
    },
    {
      "id": 34,
      "filename": "gallery/fsd_session1_1.jpg",
      "caption": "Urban farming in Jhang Road",
      "date": "2025-12-06",
      "city": "faisalabad",
      "sessionId": 26,
      "type": "event",
      "displayIn": "gallery"
    },
    {
      "id": 35,
      "filename": "gallery/fsd_session2_1.jpg",
      "caption": "Commercial farming in Samundri",
      "date": "2025-12-07",
      "city": "faisalabad",
      "sessionId": 27,
      "type": "field",
      "displayIn": "gallery"
    },
    {
      "id": 36,
      "filename": "gallery/fsd_session3_1.jpg",
      "caption": "Modern techniques in Tandlianwala",
      "date": "2025-12-08",
      "city": "faisalabad",
      "sessionId": 28,
      "type": "demonstration",
      "displayIn": "gallery"
    },
    {
      "id": 37,
      "filename": "gallery/fsd_session4_1.jpg",
      "caption": "Small landholders in Chak Jhumra",
      "date": "2025-12-09",
      "city": "faisalabad",
      "sessionId": 29,
      "type": "training",
      "displayIn": "gallery"
    },
    {
      "id": 38,
      "filename": "gallery/fsd_session5_1.jpg",
      "caption": "Technology integration in Sargodha Road",
      "date": "2025-12-10",
      "city": "faisalabad",
      "sessionId": 30,
      "type": "demonstration",
      "displayIn": "gallery"
    },
    {
      "id": 39,
      "filename": "gallery/fsd_session6_1.jpg",
      "caption": "Export quality in Jaranwala",
      "date": "2025-12-11",
      "city": "faisalabad",
      "sessionId": 31,
      "type": "quality",
      "displayIn": "gallery"
    },
    {
      "id": 40,
      "filename": "gallery/fsd_session7_1.jpg",
      "caption": "Organic alternatives in Gojra",
      "date": "2025-12-11",
      "city": "faisalabad",
      "sessionId": 32,
      "type": "demonstration",
      "displayIn": "gallery"
    },
    {
      "id": 41,
      "filename": "gallery/fsd_session8_1.jpg",
      "caption": "Sustainable farming in Toba Tek Singh",
      "date": "2025-12-12",
      "city": "faisalabad",
      "sessionId": 33,
      "type": "sustainable",
      "displayIn": "gallery"
    },
    {
      "id": 42,
      "filename": "gallery/gsm_session1_1.jpg",
      "caption": "Traditional methods in Wazirabad",
      "date": "2025-12-10",
      "city": "gujranwala",
      "sessionId": 34,
      "type": "event",
      "displayIn": "gallery"
    },
    {
      "id": 43,
      "filename": "gallery/gsm_session2_1.jpg",
      "caption": "Hybrid solutions in Kamoke",
      "date": "2025-12-11",
      "city": "gujranwala",
      "sessionId": 35,
      "type": "demonstration",
      "displayIn": "gallery"
    },
    {
      "id": 44,
      "filename": "gallery/gsm_session3_1.jpg",
      "caption": "Water conservation in Nowshera Virkan",
      "date": "2025-12-11",
      "city": "gujranwala",
      "sessionId": 36,
      "type": "conservation",
      "displayIn": "gallery"
    },
    {
      "id": 45,
      "filename": "gallery/gsm_session4_1.jpg",
      "caption": "Market linkages in Gujranwala City",
      "date": "2025-12-12",
      "city": "gujranwala",
      "sessionId": 37,
      "type": "training",
      "displayIn": "gallery"
    },
    {
      "id": 46,
      "filename": "gallery/gsm_session5_1.jpg",
      "caption": "Quality standards in Eminabad",
      "date": "2025-12-12",
      "city": "gujranwala",
      "sessionId": 38,
      "type": "quality",
      "displayIn": "gallery"
    },
    {
      "id": 47,
      "filename": "gallery/gsm_session6_1.jpg",
      "caption": "Post-harvest management in Qila Didar Singh",
      "date": "2025-12-12",
      "city": "gujranwala",
      "sessionId": 39,
      "type": "management",
      "displayIn": "gallery"
    },
    {
      "id": 48,
      "filename": "gallery/gsm_session7_1.jpg",
      "caption": "Campaign summary in Alipur Chatha",
      "date": "2025-12-12",
      "city": "gujranwala",
      "sessionId": 40,
      "type": "closing",
      "displayIn": "gallery"
    }
  ],
  "lastUpdated": "2025-12-22"
};

// Global variables
let campaignData = embeddedCampaignData;
let mediaData = embeddedMediaData;
let map = null;
let markers = [];
let currentFilteredSessions = [];
let allSessions = [];

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing AgriVista Dashboard...');
    
    // Hide error banner initially
    document.getElementById('errorBanner').style.display = 'none';
    
    try {
        // Use embedded data
        campaignData = embeddedCampaignData;
        mediaData = embeddedMediaData;
        allSessions = campaignData.sessions;
        currentFilteredSessions = [...allSessions];
        
        // Initialize dashboard
        initializeDashboard();
        initializeMap();
        initializeGallery();
        updateAllStats();
        setupEventListeners();
        addBackgroundVideo();
        addHeaderBranding();
        
        // Update status indicator
        document.getElementById('statusIndicator').className = 'status-indicator status-success';
        document.getElementById('statusIndicator').innerHTML = '<i class="fas fa-check-circle"></i><span>Dashboard Loaded Successfully</span>';
        
        console.log('Dashboard initialized with', allSessions.length, 'sessions across', campaignData.cities.length, 'cities');
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        document.getElementById('errorBanner').style.display = 'flex';
        document.getElementById('errorMessage').textContent = 'Error: ' + error.message;
        document.getElementById('statusIndicator').className = 'status-indicator status-error';
        document.getElementById('statusIndicator').innerHTML = '<i class="fas fa-exclamation-circle"></i><span>Initialization Error</span>';
    }
});

// Add CSS styles for enhanced features
function addDashboardStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .gallery-filters {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        
        .gallery-filter-btn {
            padding: 6px 12px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 16px;
            cursor: pointer;
            transition: all 0.3s;
            font-size: 12px;
            border: none;
        }
        
        .gallery-filter-btn.active {
            background: #2e7d32;
            color: white;
            border-color: #2e7d32;
        }
        
        .gallery-filter-btn:hover:not(.active) {
            background: #e9ecef;
        }
        
        .gallery-item {
            position: relative;
            overflow: hidden;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: transform 0.3s;
            background: white;
        }
        
        .gallery-item:hover {
            transform: translateY(-3px);
        }
        
        .gallery-item img {
            transition: transform 0.5s ease;
            width: 100%;
            height: 180px;
            object-fit: cover;
            display: block;
        }
        
        .gallery-item:hover img {
            transform: scale(1.05);
        }
        
        .branding-container {
            position: absolute;
            top: 20px;
            right: 20px;
            display: flex;
            gap: 10px;
            align-items: center;
            z-index: 1;
        }
        
        .brand-logo {
            height: 30px;
            background: white;
            padding: 4px;
            border-radius: 4px;
            opacity: 0.9;
        }
        
        .chart-container {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .session-marker {
            background: none !important;
            border: none !important;
        }
        
        /* Map legend */
        .map-legend {
            position: absolute;
            bottom: 10px;
            right: 10px;
            background: white;
            padding: 10px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 1000;
            font-size: 12px;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            margin: 5px 0;
        }
        
        .legend-color {
            width: 15px;
            height: 15px;
            border-radius: 50%;
            margin-right: 8px;
        }
        
        .city-marker-color {
            background: #2e7d32;
        }
        
        .session-marker-color {
            background: #ff9800;
        }
    `;
    document.head.appendChild(style);
}

// Initialize dashboard components
function initializeDashboard() {
    console.log('Initializing dashboard components...');
    
    // Add styles
    addDashboardStyles();
    
    // Set date range max to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateTo').max = today;
    
    // Populate city filter dropdown
    const cityFilter = document.getElementById('cityFilter');
    cityFilter.innerHTML = '<option value="all">All Cities</option>';
    
    campaignData.cities.forEach(city => {
        const option = document.createElement('option');
        option.value = city.code.toLowerCase();
        option.textContent = `${city.name} (${city.code})`;
        cityFilter.appendChild(option);
    });
    
    // Initialize tabs
    initializeTabs();
}

// Initialize tabs
function initializeTabs() {
    // Set first tab as active
    const defaultTab = 'snapshot';
    document.querySelector(`[data-tab="${defaultTab}"]`).classList.add('active');
    
    // Show default tab content
    document.getElementById('snapshotTab').style.display = 'block';
    
    // Add tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            // Update active tab
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding section
            const tabId = this.getAttribute('data-tab');
            const allSections = document.querySelectorAll('#tabContent > section');
            allSections.forEach(section => {
                section.style.display = section.id === tabId + 'Tab' ? 'block' : 'none';
            });
            
            // Special handling for map tab
            if (tabId === 'map' && map) {
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
            }
            
            // Special handling for analytics tab
            if (tabId === 'analytics') {
                showAnalyticsTab();
            }
            
            // Special handling for sessions tab
            if (tabId === 'sessions') {
                showSessionsTab();
            }
        });
    });
}

// Initialize Leaflet map
function initializeMap() {
    console.log('Initializing map...');
    
    try {
        // Create map centered on Pakistan
        map = L.map('campaignMap').setView([30.3753, 69.3451], 6);
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 12,
            minZoom: 5
        }).addTo(map);
        
        // Add markers for each city
        campaignData.cities.forEach(city => {
            const icon = L.divIcon({
                className: 'city-marker',
                html: `<div style="
                    background: #2e7d32;
                    color: white;
                    padding: 6px 10px;
                    border-radius: 15px;
                    font-weight: bold;
                    border: 2px solid white;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                    font-size: 11px;
                    text-align: center;
                ">
                    ${city.code}<br>
                    <span style="font-size: 9px;">${city.sessions}</span>
                </div>`,
                iconSize: [50, 30],
                iconAnchor: [25, 15]
            });
            
            const marker = L.marker([city.latitude, city.longitude], { icon: icon })
                .addTo(map)
                .bindPopup(`
                    <div style="min-width: 180px;">
                        <h4 style="margin: 0 0 5px 0; color: #2e7d32;">${city.name}</h4>
                        <p style="margin: 3px 0; font-size: 12px;"><strong>Sessions:</strong> ${city.sessions}</p>
                        <p style="margin: 3px 0; font-size: 12px;"><strong>Farmers:</strong> ${city.farmers.toLocaleString()}</p>
                        <p style="margin: 3px 0; font-size: 12px;"><strong>Acres:</strong> ${city.acres.toLocaleString()}</p>
                    </div>
                `);
            
            markers.push(marker);
        });
        
        // Add session markers
        addSessionMarkers(allSessions);
        
        // Add map legend
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = function(map) {
            const div = L.DomUtil.create('div', 'map-legend');
            div.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 5px; color: #2e7d32;">Legend</div>
                <div class="legend-item">
                    <div class="legend-color city-marker-color"></div>
                    <span>City (Total Sessions)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color session-marker-color"></div>
                    <span>Session Location</span>
                </div>
            `;
            return div;
        };
        legend.addTo(map);
        
        // Update map banner
        updateMapBanner();
        
    } catch (error) {
        console.error('Error initializing map:', error);
        document.getElementById('campaignMap').innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100%; background: #f8f9fa; color: #666;">
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-map-marked-alt" style="font-size: 48px; color: #ccc; margin-bottom: 10px;"></i>
                    <p>Map visualization not available</p>
                    <p style="font-size: 12px; color: #999;">Check console for details</p>
                </div>
            </div>
        `;
    }
}

// Add session markers to map
function addSessionMarkers(sessions) {
    if (!map) return;
    
    // Clear existing session markers
    markers.forEach(marker => {
        if (marker._icon && marker._icon.className === 'session-marker') {
            map.removeLayer(marker);
        }
    });
    
    // Filter markers array to keep only city markers
    markers = markers.filter(marker => 
        !marker._icon || marker._icon.className !== 'session-marker'
    );
    
    // Add session markers (limit to 20 for performance)
    const sessionsToShow = sessions.slice(0, 20);
    
    sessionsToShow.forEach(session => {
        const icon = L.divIcon({
            className: 'session-marker',
            html: `<div style="
                background: #ff9800;
                color: white;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                border: 2px solid white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                cursor: pointer;
            ">
                <i class="fas fa-user"></i>
            </div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });
        
        const marker = L.marker([session.latitude, session.longitude], { icon: icon })
            .addTo(map)
            .bindPopup(`
                <div style="min-width: 180px; font-size: 12px;">
                    <h4 style="margin: 0 0 5px 0; color: #2e7d32; font-size: 14px;">${session.sessionNumber}</h4>
                    <p style="margin: 2px 0;"><strong>Location:</strong> ${session.spot}</p>
                    <p style="margin: 2px 0;"><strong>Date:</strong> ${session.date}</p>
                    <p style="margin: 2px 0;"><strong>Farmers:</strong> ${session.farmers}</p>
                    <p style="margin: 2px 0;"><strong>Facilitator:</strong> ${session.facilitator}</p>
                </div>
            `);
        
        markers.push(marker);
    });
}

// Update map banner statistics
function updateMapBanner() {
    const totalSessions = currentFilteredSessions.length;
    const uniqueCities = [...new Set(currentFilteredSessions.map(s => s.cityName))];
    const totalFarmers = currentFilteredSessions.reduce((sum, session) => sum + session.farmers, 0);
    
    document.getElementById('mapStats').textContent = 
        `${totalSessions} Sessions • ${uniqueCities.length} Cities • ${totalFarmers.toLocaleString()} Farmers`;
}

// Initialize gallery
function initializeGallery() {
    const galleryContainer = document.getElementById('mediaGallery');
    
    if (!galleryContainer) return;
    
    // Clear loading message
    galleryContainer.innerHTML = '';
    
    // Filter gallery images only
    const galleryImages = mediaData.mediaItems.filter(item => item.displayIn === "gallery");
    
    if (galleryImages.length === 0) {
        galleryContainer.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-images" style="font-size: 48px; margin-bottom: 10px; color: #ccc;"></i>
                <p>No gallery images available</p>
            </div>
        `;
        return;
    }
    
    // Create gallery items (limit to 12 for performance)
    const imagesToShow = galleryImages.slice(0, 12);
    
    imagesToShow.forEach(media => {
        const galleryItem = document.createElement('div');
        galleryItem.className = 'gallery-item';
        
        // Create placeholder image with city color
        const cityColors = {
            'sukkur': '#2e7d32',
            'dgk': '#ff9800',
            'faisalabad': '#2196f3',
            'gujranwala': '#9c27b0'
        };
        const color = cityColors[media.city] || '#2e7d32';
        const imgSrc = `https://via.placeholder.com/300x180/${color.replace('#', '')}/ffffff?text=${encodeURIComponent(media.city.toUpperCase() + ': ' + media.type)}`;
        
        galleryItem.innerHTML = `
            <img src="${imgSrc}" alt="${media.caption}" loading="lazy">
            <div style="padding: 12px;">
                <div style="font-weight: bold; margin-bottom: 4px; color: #2e7d32; font-size: 11px; text-transform: uppercase;">
                    ${media.city} • Session ${media.sessionId}
                </div>
                <div style="font-size: 13px; color: #666; margin-bottom: 6px; line-height: 1.3;">${media.caption}</div>
                <div style="font-size: 11px; color: #999; display: flex; justify-content: space-between;">
                    <span><i class="fas fa-calendar"></i> ${media.date}</span>
                    <span><i class="fas fa-tag"></i> ${media.type}</span>
                </div>
            </div>
        `;
        
        galleryContainer.appendChild(galleryItem);
    });
    
    // Add gallery filters
    const gallerySection = document.getElementById('galleryTab');
    if (gallerySection && !document.querySelector('.gallery-filters')) {
        const filtersHtml = `
            <div class="gallery-filters">
                <button class="gallery-filter-btn active" data-filter="all">All Cities</button>
                <button class="gallery-filter-btn" data-filter="sukkur">Sukkur</button>
                <button class="gallery-filter-btn" data-filter="dgk">Dera Ghazi Khan</button>
                <button class="gallery-filter-btn" data-filter="faisalabad">Faisalabad</button>
                <button class="gallery-filter-btn" data-filter="gujranwala">Gujranwala</button>
            </div>
        `;
        
        gallerySection.querySelector('p').insertAdjacentHTML('afterend', filtersHtml);
        
        // Add filter event listeners
        document.querySelectorAll('.gallery-filter-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.gallery-filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                filterGallery(this.getAttribute('data-filter'));
            });
        });
    }
}

// Filter gallery items
function filterGallery(filter) {
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    galleryItems.forEach(item => {
        const cityText = item.querySelector('div div:first-child').textContent.toLowerCase();
        const showItem = filter === 'all' || cityText.includes(filter);
        item.style.display = showItem ? 'block' : 'none';
    });
}

// Update all statistics
function updateAllStats() {
    const totalSessions = currentFilteredSessions.length;
    const totalFarmers = currentFilteredSessions.reduce((sum, session) => sum + session.farmers, 0);
    const totalAcres = currentFilteredSessions.reduce((sum, session) => sum + session.acres, 0);
    const uniqueCities = [...new Set(currentFilteredSessions.map(s => s.cityName))];
    
    // Update summary stats
    document.getElementById('sessionCount').textContent = totalSessions;
    document.getElementById('farmerCount').textContent = totalFarmers.toLocaleString();
    document.getElementById('acreCount').textContent = totalAcres.toLocaleString();
    
    // Update overview stats
    document.getElementById('totalSessions').textContent = totalSessions;
    document.getElementById('totalFarmers').textContent = totalFarmers.toLocaleString();
    document.getElementById('totalAcres').textContent = totalAcres.toLocaleString();
    
    // Update selection summary
    document.getElementById('statusIndicator').innerHTML = 
        `<i class="fas fa-filter"></i><span>${totalSessions} sessions • ${uniqueCities.length} cities</span>`;
    
    // Update map banner
    updateMapBanner();
}

// Setup event listeners
function setupEventListeners() {
    // Search button
    document.getElementById('searchBtn').addEventListener('click', applyFilters);
    
    // Export CSV button
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    
    // Reset button
    document.getElementById('resetBtn').addEventListener('click', resetFilters);
    
    // Search input (live search)
    document.getElementById('searchInput').addEventListener('input', function(e) {
        if (e.target.value.length > 2 || e.target.value.length === 0) {
            applyFilters();
        }
    });
    
    // City and spot filters
    document.getElementById('cityFilter').addEventListener('change', applyFilters);
    document.getElementById('spotFilter').addEventListener('change', applyFilters);
    
    // Date filters
    document.getElementById('dateFrom').addEventListener('change', applyFilters);
    document.getElementById('dateTo').addEventListener('change', applyFilters);
}

// Apply filters
function applyFilters() {
    const cityFilter = document.getElementById('cityFilter').value;
    const spotFilter = document.getElementById('spotFilter').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    
    // Filter sessions
    currentFilteredSessions = allSessions.filter(session => {
        // City filter
        if (cityFilter !== 'all' && session.city !== cityFilter) {
            return false;
        }
        
        // Spot filter (simplified)
        if (spotFilter !== 'all') {
            const isMajor = session.farmers > 80;
            if (spotFilter === 'major' && !isMajor) return false;
            if (spotFilter === 'secondary' && isMajor) return false;
        }
        
        // Date filter
        const sessionDate = new Date(session.date);
        const fromDate = new Date(dateFrom);
        const toDate = new Date(dateTo);
        if (sessionDate < fromDate || sessionDate > toDate) return false;
        
        // Search filter
        if (searchQuery) {
            const searchIn = `${session.cityName} ${session.spot} ${session.facilitator}`.toLowerCase();
            if (!searchIn.includes(searchQuery)) return false;
        }
        
        return true;
    });
    
    updateAllStats();
    addSessionMarkers(currentFilteredSessions);
}

// Reset filters
function resetFilters() {
    document.getElementById('cityFilter').value = 'all';
    document.getElementById('spotFilter').value = 'all';
    document.getElementById('dateFrom').value = '2025-11-24';
    document.getElementById('dateTo').value = '2025-12-12';
    document.getElementById('searchInput').value = '';
    
    currentFilteredSessions = [...allSessions];
    updateAllStats();
    addSessionMarkers(currentFilteredSessions);
    
    // Show success message
    const statusIndicator = document.getElementById('statusIndicator');
    const originalHTML = statusIndicator.innerHTML;
    statusIndicator.className = 'status-indicator status-success';
    statusIndicator.innerHTML = '<i class="fas fa-check-circle"></i><span>Filters Reset</span>';
    
    setTimeout(() => {
        statusIndicator.innerHTML = originalHTML;
    }, 2000);
}

// Export to CSV
function exportToCSV() {
    if (currentFilteredSessions.length === 0) {
        alert('No data to export');
        return;
    }
    
    const headers = ['Session ID', 'City', 'Spot', 'Date', 'Farmers', 'Acres', 'Facilitator'];
    const csvRows = [
        headers.join(','),
        ...currentFilteredSessions.map(session => [
            session.sessionNumber,
            session.cityName,
            `"${session.spot}"`,
            session.date,
            session.farmers,
            session.acres,
            `"${session.facilitator}"`
        ].join(','))
    ];
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = `agrivista-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Show analytics tab
function showAnalyticsTab() {
    const analyticsTab = document.getElementById('analyticsTab');
    if (!analyticsTab) {
        const tabContent = document.getElementById('tabContent');
        const analyticsHtml = `
            <section class="campaign-section" id="analyticsTab" style="display: block;">
                <h2><i class="fas fa-chart-bar"></i> Campaign Analytics</h2>
                <p>Performance metrics and insights</p>
                
                <div class="chart-container">
                    <h3>Sessions Distribution</h3>
                    <div id="cityChart" style="height: 200px; display: flex; align-items: flex-end; gap: 20px; padding: 20px; border-bottom: 1px solid #eee;">
                        ${campaignData.cities.map(city => {
                            const height = (city.sessions / 15) * 150;
                            return `
                                <div style="flex: 1; text-align: center;">
                                    <div style="height: ${height}px; background: linear-gradient(to top, #2e7d32, #4caf50); border-radius: 3px 3px 0 0; position: relative;">
                                        <div style="position: absolute; top: -25px; left: 0; right: 0; font-weight: bold; color: #2e7d32;">${city.sessions}</div>
                                    </div>
                                    <div style="margin-top: 10px; font-weight: bold; color: #666;">${city.code}</div>
                                    <div style="font-size: 11px; color: #999;">${city.farmers} farmers</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <div class="chart-container">
                    <h3>Performance Metrics</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
                        ${Object.entries(campaignData.metrics).map(([key, value]) => `
                            <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                                <div style="font-size: 28px; font-weight: bold; color: #2e7d32;">${value}%</div>
                                <div style="font-size: 12px; color: #666; text-transform: capitalize;">${key.replace(/([A-Z])/g, ' $1')}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </section>
        `;
        tabContent.insertAdjacentHTML('beforeend', analyticsHtml);
    } else {
        analyticsTab.style.display = 'block';
    }
}

// Show sessions tab
function showSessionsTab() {
    const sessionsTab = document.getElementById('sessionsTab');
    if (!sessionsTab) {
        const tabContent = document.getElementById('tabContent');
        const sessionsHtml = `
            <section class="campaign-section" id="sessionsTab" style="display: block;">
                <h2><i class="fas fa-calendar-day"></i> All Sessions</h2>
                <p>Complete list of farmer education sessions</p>
                
                <div style="overflow-x: auto;">
                    <table class="sessions-table" style="font-size: 13px;">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>City</th>
                                <th>Spot</th>
                                <th>Date</th>
                                <th>Farmers</th>
                                <th>Acres</th>
                                <th>Facilitator</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${currentFilteredSessions.map(session => `
                                <tr>
                                    <td><strong>${session.sessionNumber}</strong></td>
                                    <td>${session.cityName}</td>
                                    <td>${session.spot}</td>
                                    <td>${session.date}</td>
                                    <td>${session.farmers}</td>
                                    <td>${session.acres.toLocaleString()}</td>
                                    <td>${session.facilitator}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </section>
        `;
        tabContent.insertAdjacentHTML('beforeend', sessionsHtml);
    } else {
        sessionsTab.style.display = 'block';
    }
}

// Add background video
function addBackgroundVideo() {
    if (document.getElementById('backgroundVideo')) return;
    
    const videoHTML = `
        <video id="backgroundVideo" autoplay muted loop playsinline style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            z-index: -1;
            opacity: 0.03;
        ">
            <!-- Fallback to gradient if video doesn't load -->
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%);"></div>
        </video>
    `;
    
    document.body.insertAdjacentHTML('afterbegin', videoHTML);
}

// Add header branding
function addHeaderBranding() {
    const header = document.querySelector('.header');
    if (header && !document.querySelector('.branding-container')) {
        const brandingHTML = `
            <div class="branding-container">
                <div style="display: flex; gap: 8px; align-items: center; background: rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 5px;">
                    <span style="color: white; font-size: 11px; font-weight: bold;">Bayer</span>
                    <span style="color: white; font-size: 11px;">|</span>
                    <span style="color: white; font-size: 11px;">Buttril Super</span>
                </div>
            </div>
        `;
        header.insertAdjacentHTML('beforeend', brandingHTML);
    }
}

console.log('AgriVista Dashboard - Complete Embedded Data Version');
