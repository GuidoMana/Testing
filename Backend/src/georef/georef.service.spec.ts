import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { of, throwError } from 'rxjs';
import { GeorefService } from './georef.service';
import { GeorefProvincia, GeorefMunicipio } from '../interfaces/georef.interfaces';

describe('GeorefService', () => {
  let service: GeorefService;
  let httpService: HttpService;

  const mockHttpService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeorefService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<GeorefService>(GeorefService);
    httpService = module.get<HttpService>(HttpService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProvincias', () => {
    const mockProvincias: GeorefProvincia[] = [
      {
        id: '06',
        nombre: 'Buenos Aires',
        centroide: { lat: -36.6769, lon: -60.5588 },
      },
      {
        id: '02',
        nombre: 'Córdoba',
        centroide: { lat: -32.1429, lon: -63.8017 },
      },
    ];

    it('should return provinces successfully', async () => {
      const mockResponse = {
        data: {
          provincias: mockProvincias,
        },
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getProvincias();

      expect(mockHttpService.get).toHaveBeenCalledWith('/provincias', {
        params: { campos: 'id,nombre,centroide.lat,centroide.lon', max: 50 },
      });
      expect(result).toEqual(mockProvincias);
    });

    it('should throw error when HTTP call fails', async () => {
      const axiosError = new AxiosError('Network Error', '500');
      axiosError.response = { status: 500, data: 'Server Error' } as any;

      mockHttpService.get.mockReturnValue(throwError(() => axiosError));

      await expect(service.getProvincias()).rejects.toBe('Error al obtener provincias de Georef: Network Error');
    });

    it('should throw error when observable fails', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('Observable Error')));

      await expect(service.getProvincias()).rejects.toBe('Error al obtener provincias de Georef: Observable Error');
    });
  });

  describe('getMunicipios', () => {
    const mockMunicipios: GeorefMunicipio[] = [
      {
        id: '060001',
        nombre: 'La Plata',
        provincia: { id: '06', nombre: 'Buenos Aires' },
        centroide: { lat: -34.9214, lon: -57.9544 },
      },
      {
        id: '020001',
        nombre: 'Córdoba',
        provincia: { id: '02', nombre: 'Córdoba' },
        centroide: { lat: -31.4167, lon: -64.1833 },
      },
    ];

    it('should return municipalities successfully', async () => {
      const mockResponse = {
        data: {
          municipios: mockMunicipios,
        },
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getMunicipios();

      expect(mockHttpService.get).toHaveBeenCalledWith('/municipios', {
        params: { campos: 'id,nombre,provincia.id,provincia.nombre,centroide.lat,centroide.lon', max: 5000 },
      });
      expect(result).toEqual(mockMunicipios);
    });

    it('should throw error when HTTP call fails', async () => {
      const axiosError = new AxiosError('Network Error', '500');
      axiosError.response = { status: 500, data: 'Server Error' } as any;

      mockHttpService.get.mockReturnValue(throwError(() => axiosError));

      await expect(service.getMunicipios()).rejects.toBe('Error al obtener municipios de Georef: Network Error');
    });

    it('should throw error when observable fails', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('Observable Error')));

      await expect(service.getMunicipios()).rejects.toBe('Error al obtener municipios de Georef: Observable Error');
    });
  });
});
