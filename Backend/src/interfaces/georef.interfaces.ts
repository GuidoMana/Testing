// src/georef/interfaces/georef.interfaces.ts

export interface GeorefCentroide {
  lat: number;
  lon: number;
}

export interface GeorefProvincia {
  id: string;
  nombre: string;
  centroide: GeorefCentroide;
}

export interface GeorefProvinciasResponse {
  cantidad: number;
  inicio: number;
  parametros: object;
  provincias: GeorefProvincia[];
  total: number;
}

export interface GeorefMunicipio {
  id: string;
  nombre: string;
  provincia: {
    id: string;
    nombre: string;
  };
  centroide: GeorefCentroide;
}

export interface GeorefMunicipiosResponse {
  cantidad: number;
  inicio: number;
  parametros: object;
  municipios: GeorefMunicipio[];
  total: number;
}