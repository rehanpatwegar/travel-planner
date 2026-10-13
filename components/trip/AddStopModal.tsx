"use client";

import { useState, useEffect } from "react";
import {
  X,
  MapPin,
  Search,
  Plus,
  Loader2,
  DollarSign,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CityCatalogItem } from "./types";

interface AddStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddStop: (stopData: {
    city_id?: string;
    custom_city_name?: string;
    arrival_date?: string;
    departure_date?: string;
    notes?: string;
  }) => Promise<void>;
}

export function AddStopModal({
  isOpen,
  onClose,
  onAddStop,
}: AddStopModalProps) {
  const [cities, setCities] = useState<CityCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<CityCatalogItem | null>(null);
  const [customCityName, setCustomCityName] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function loadCities() {
      if (cities.length > 0) return;
      setLoading(true);
      try {
        const res = await fetch("/api/cities");
        if (res.ok) {
          const data = await res.json();
          setCities(data || []);
        }
      } catch (err) {
        console.error("Failed to load cities catalog:", err);
      } finally {
        setLoading(false);
      }
    }

    loadCities();
  }, [isOpen, cities.length]);

  if (!isOpen) return null;

  const filteredCities = cities.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.country.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const cityName = selectedCity ? selectedCity.name : customCityName.trim();
    if (!cityName) {
      setErrorMsg("Please select a destination from catalog or enter custom city name");
      return;
    }

    setSubmitting(true);
    try {
      await onAddStop({
        city_id: selectedCity?.id,
        custom_city_name: cityName,
        arrival_date: arrivalDate || undefined,
        departure_date: departureDate || undefined,
        notes: notes.trim() || undefined,
      });

      // Reset
      setSelectedCity(null);
      setCustomCityName("");
      setArrivalDate("");
      setDepartureDate("");
      setNotes("");
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to add destination stop");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Add Destination Stop</h3>
            <p className="text-xs text-slate-500">
              Add a city stop along your travel route.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* City Selection from Catalog */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select City from Catalog
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search cities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>

            <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-1.5 space-y-1">
              {loading ? (
                <div className="py-6 text-center text-xs text-slate-400">Loading cities...</div>
              ) : filteredCities.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">No matching cities found.</div>
              ) : (
                filteredCities.map((city) => {
                  const isSelected = selectedCity?.id === city.id;
                  return (
                    <button
                      key={city.id}
                      type="button"
                      onClick={() => {
                        setSelectedCity(city);
                        setCustomCityName(city.name);
                      }}
                      className={`w-full flex items-center justify-between rounded-md p-2 text-left text-xs transition-colors ${
                        isSelected
                          ? "bg-blue-600 text-white font-semibold"
                          : "hover:bg-slate-100 text-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>
                          {city.name}, {city.country}
                        </span>
                      </div>
                      <span className={`text-[10px] ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                        ${city.average_daily_cost}/day
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Or Custom City Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Or Custom Destination Name
            </label>
            <Input
              placeholder="e.g., Lake Como, Italy"
              value={customCityName}
              onChange={(e) => {
                setCustomCityName(e.target.value);
                if (selectedCity && selectedCity.name !== e.target.value) {
                  setSelectedCity(null);
                }
              }}
              className="text-xs h-9"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Arrival Date (Optional)
              </label>
              <Input
                type="date"
                value={arrivalDate}
                onChange={(e) => setArrivalDate(e.target.value)}
                className="text-xs h-9"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Departure Date (Optional)
              </label>
              <Input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notes (Optional)
            </label>
            <Input
              placeholder="Accommodation booked, transit tips, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs h-9"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add Destination Stop
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

