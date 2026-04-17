"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

// Konya ilçe koordinatları (merkez noktalar, yaklaşık)
const DISTRICT_COORDS: Record<string, [number, number]> = {
  "Selçuklu": [37.9533, 32.4933],
  "Meram": [37.8500, 32.4500],
  "Karatay": [37.8750, 32.5500],
  "Ereğli": [37.5128, 34.0483],
  "Akşehir": [38.3572, 31.4161],
  "Beyşehir": [37.6761, 31.7250],
  "Seydişehir": [37.4208, 31.8494],
  "Çumra": [37.5700, 32.7794],
  "Ilgın": [38.2772, 31.9144],
  "Kulu": [39.0964, 33.0786],
  "Cihanbeyli": [38.6514, 32.9228],
  "Hadim": [36.9892, 32.4575],
  "Bozkır": [37.1908, 32.2483],
  "Taşkent": [36.9269, 32.4967],
  "Hüyük": [37.9481, 31.5939],
  "Altınekin": [38.3047, 32.8617],
  "Derbent": [38.0178, 32.0433],
  "Derebucak": [37.3817, 31.5014],
  "Doğanhisar": [38.1406, 31.6703],
  "Emirgazi": [37.8922, 33.8339],
  "Güneysınır": [37.2689, 32.7261],
  "Halkapınar": [37.4075, 34.0522],
  "Karapınar": [37.7156, 33.5500],
  "Tuzlukçu": [38.4911, 31.6522],
  "Yalıhüyük": [37.2986, 32.0731],
  "Yunak": [38.8161, 31.7300],
  "Çeltik": [38.7839, 31.7864],
  "Akören": [37.4631, 32.3772],
  "Sarayönü": [38.2572, 32.4083],
  "Kadınhanı": [38.2392, 32.2247],
};

const NORMALIZE_MAP: Record<string, string> = {
  "selcuklu": "Selçuklu", "meram": "Meram", "karatay": "Karatay",
  "eregli": "Ereğli", "aksehir": "Akşehir", "beysehir": "Beyşehir",
  "seydisehir": "Seydişehir", "cumra": "Çumra", "ilgin": "Ilgın",
  "kulu": "Kulu", "cihanbeyli": "Cihanbeyli", "hadim": "Hadim",
  "bozkir": "Bozkır", "taskent": "Taşkent", "huyuk": "Hüyük",
  "altinekin": "Altınekin", "derbent": "Derbent", "derebucak": "Derebucak",
  "doganhisar": "Doğanhisar", "emirgazi": "Emirgazi", "guneysinir": "Güneysınır",
  "halkapinar": "Halkapınar", "karapinar": "Karapınar", "tuzlukcu": "Tuzlukçu",
  "yalihuyuk": "Yalıhüyük", "yunak": "Yunak", "celtik": "Çeltik",
  "akoren": "Akören", "sarayonu": "Sarayönü", "kadinhani": "Kadınhanı",
};

function normalizeName(s: string): string {
  const lower = s.toLowerCase().replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c").replace(/İ/g, "i");
  return NORMALIZE_MAP[lower] || s;
}

interface DistrictData {
  district: string;
  count: number;
  avgPrice: number;
  pricePerSqm: number;
  listings: Array<{ id: string; title: string; price: number | null; listingType: string }>;
}

function FitBounds({ districts }: { districts: DistrictData[] }) {
  const map = useMap();
  useEffect(() => {
    const coords = districts
      .map((d) => DISTRICT_COORDS[normalizeName(d.district)])
      .filter((c): c is [number, number] => !!c);
    if (coords.length > 0) {
      const lats = coords.map((c) => c[0]);
      const lngs = coords.map((c) => c[1]);
      map.fitBounds([[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]], { padding: [30, 30] });
    }
  }, [map, districts]);
  return null;
}

export default function KonyaMap({ data }: { data: DistrictData[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="h-[500px] w-full rounded-lg overflow-hidden border border-[var(--border)]">
      <MapContainer center={[37.87, 32.48]} zoom={8} className="h-full w-full" scrollWheelZoom={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds districts={data} />
        {data.map((d) => {
          const canonical = normalizeName(d.district);
          const coords = DISTRICT_COORDS[canonical];
          if (!coords) return null;
          const radius = 8 + Math.round((d.count / maxCount) * 22);
          const color = d.count >= maxCount * 0.6 ? "#dc2626" : d.count >= maxCount * 0.3 ? "#ea580c" : "#2563eb";

          return (
            <CircleMarker
              key={d.district}
              center={coords}
              radius={radius}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.5, weight: 2 }}
            >
              <Popup>
                <div className="space-y-1 min-w-[180px]">
                  <div className="font-bold text-sm">{canonical}</div>
                  <div className="text-xs text-gray-600">{d.count} ilan</div>
                  <div className="text-sm font-semibold text-blue-600">
                    Ort: {formatPrice(d.avgPrice)}
                  </div>
                  {d.pricePerSqm > 0 && (
                    <div className="text-xs">m² birim: {formatPrice(d.pricePerSqm)}</div>
                  )}
                  {d.listings.length > 0 && (
                    <div className="pt-1 border-t border-gray-200 space-y-1">
                      {d.listings.slice(0, 3).map((l) => (
                        <Link
                          key={l.id}
                          href={`/my-listings/${l.id}`}
                          className="block text-xs text-blue-600 hover:underline truncate"
                        >
                          • {l.title.substring(0, 35)}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
