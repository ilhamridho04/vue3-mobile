import request from '@/utils/request'

export interface WarehouseDto {
    id: number
    code: string
    name: string
    address?: string
}

export interface ProductLookupParams {
    barcode?: string
    query?: string
    warehouse_id?: number
    limit?: number
}

export function listWarehouses() {
    return request.get('/mobile/wms/warehouses')
}

export function productLookup(params: ProductLookupParams) {
    return request.get('/mobile/wms/products/lookup', { params })
}

export function listInbound(params: Record<string, any> = {}) {
    return request.get('/mobile/wms/inbound', { params })
}

export function createInbound(payload: any) {
    return request.post('/mobile/wms/inbound', payload)
}

export function getInbound(id: number) {
    return request.get(`/mobile/wms/inbound/${id}`)
}

export function verifyInbound(id: number) {
    return request.post(`/mobile/wms/inbound/${id}/verify`)
}

export function cancelInbound(id: number) {
    return request.post(`/mobile/wms/inbound/${id}/cancel`)
}

export function listOutbound(params: Record<string, any> = {}) {
    return request.get('/mobile/wms/outbound', { params })
}

export function createOutbound(payload: any) {
    return request.post('/mobile/wms/outbound', payload)
}

export function getOutbound(id: number) {
    return request.get(`/mobile/wms/outbound/${id}`)
}

export function prepareOutbound(id: number) {
    return request.post(`/mobile/wms/outbound/${id}/prepare`)
}

export function shipOutbound(id: number) {
    return request.post(`/mobile/wms/outbound/${id}/ship`)
}

export function deliveredOutbound(id: number) {
    return request.post(`/mobile/wms/outbound/${id}/delivered`)
}

export function cancelOutbound(id: number) {
    return request.post(`/mobile/wms/outbound/${id}/cancel`)
}
