export const barangayGeoJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        psgc_code: "Barangay San Roque",
        name: "Barangay San Roque",
        risk_level: "severe",
        flood_probability: 0.86,
        vulnerable_people: 420 //
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [121.090, 14.580],
            [121.100, 14.580],
            [121.100, 14.590],
            [121.090, 14.590],
            [121.090, 14.580]
          ]
        ]
      }
    },
    {
      type: "Feature",
      properties: {
        psgc_code: "Barangay Mabini",
        name: "Barangay Mabini",
        risk_level: "high",
        flood_probability: 0.68,
        vulnerable_people: 260 //
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [121.100, 14.580],
            [121.110, 14.580],
            [121.110, 14.590],
            [121.100, 14.590],
            [121.100, 14.580]
          ]
        ]
      }
    },
    {
      type: "Feature",
      properties: {
        psgc_code: "Barangay Maligaya",
        name: "Barangay Maligaya",
        risk_level: "moderate",
        flood_probability: 0.43,
        vulnerable_people: 170 //[cite: 20]
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [121.090, 14.570],
            [121.100, 14.570],
            [121.100, 14.580],
            [121.090, 14.580],
            [121.090, 14.570]
          ]
        ]
      }
    },
    {
      type: "Feature",
      properties: {
        psgc_code: "Barangay Pag-asa",
        name: "Barangay Pag-asa",
        risk_level: "low",
        flood_probability: 0.18,
        vulnerable_people: 95 //[cite: 20]
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [121.100, 14.570],
            [121.110, 14.570],
            [121.110, 14.580],
            [121.100, 14.580],
            [121.100, 14.570]
          ]
        ]
      }
    }
  ]
};