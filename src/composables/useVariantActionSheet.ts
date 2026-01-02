import { reactive } from 'vue'

export interface VariantLike {
    id: number
    variant_name: string
    variant_sku?: string | null
    variant_barcode?: string | null
}

export interface VariantAction {
    name: string
    key: string
    variant?: VariantLike
}

export function useVariantActionSheetPicker() {
    const variantSheet = reactive({
        show: false,
        actions: [] as VariantAction[],
    })

    let variantSheetResolve: ((action: VariantAction | null) => void) | null = null

    function pickVariantAction(variants: VariantLike[]) {
        return new Promise<VariantAction | null>((resolve) => {
            variantSheet.actions = [
                { name: 'Tanpa Variant', key: 'none' },
                ...variants.map(v => ({
                    name: `${v.variant_name}${v.variant_sku ? ` (${v.variant_sku})` : ''}`,
                    key: `v:${v.id}`,
                    variant: v,
                })),
            ]
            variantSheet.show = true
            variantSheetResolve = resolve
        })
    }

    function onVariantSelect(action: any) {
        variantSheet.show = false
        variantSheetResolve?.(action as VariantAction)
        variantSheetResolve = null
    }

    function onVariantCancel() {
        variantSheet.show = false
        variantSheetResolve?.(null)
        variantSheetResolve = null
    }

    return {
        variantSheet,
        pickVariantAction,
        onVariantSelect,
        onVariantCancel,
    }
}
