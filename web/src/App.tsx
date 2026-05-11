import { useEffect, useState } from 'react'
import { MriDashboardLayout, MriPageHeader, MriButton, MriTabs, MriTabletFrame } from '@mriqbox/ui-kit'
import { Box, X, Home, Settings } from 'lucide-react'

import { useIsEmbedded } from './plugin/useIsEmbedded'
import { usePluginBridgeGuest } from './plugin/usePluginBridgeGuest'
import { useAccentColor } from './hooks/useAccentColor'
import { useLocales } from './hooks/useLocales'
import { useNuiEvent, fetchNui } from './context/NuiContext'
import { HelloPlugin } from './components/HelloPlugin'
import { ConfigPanel } from './components/ConfigPanel'

type Route = 'home' | 'config'

// Conteudo principal — compartilhado entre standalone e embedded. So muda o
// que esta ao redor (frame externo, dispatch de close).
function PluginContent({ onClose, route, onRouteChange, embedded, locale }: {
    onClose?: () => void
    route: Route
    onRouteChange: (r: Route) => void
    embedded: boolean
    locale: string
}) {
    const { t } = useLocales(locale)

    const subnav = (
        <MriTabs
            items={[
                { label: t('ui.nav_home'), icon: Home, route: 'home' },
                { label: t('ui.nav_config'), icon: Settings, route: 'config' },
            ]}
            activeRoute={route}
            onNavigate={(r) => onRouteChange(r as Route)}
            rightContent={!embedded && onClose ? (
                <MriButton variant="ghost" size="sm" onClick={onClose}>
                    <X className="w-4 h-4 mr-1" /> {t('ui.close')}
                </MriButton>
            ) : undefined}
        />
    )

    return (
        <MriDashboardLayout subnav={subnav}>
            {route === 'home' ? (
                <div className="p-6">
                    <MriPageHeader title={t('ui.plugin_title')} icon={Box} />
                    <HelloPlugin locale={locale} />
                </div>
            ) : (
                <ConfigPanel locale={locale} />
            )}
        </MriDashboardLayout>
    )
}

// Modo embedded: roda hospedado pelo mri_Qadmin via iframe. Aceita init do
// host (accentColor + locale) e re-aplica em runtime.
function EmbeddedMode() {
    const bridge = usePluginBridgeGuest({ defaultAccentColor: '#00E699' })
    const [route, setRoute] = useState<Route>('home')

    useAccentColor(bridge.accentColor)

    if (!bridge.initialized) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-background text-muted-foreground text-sm">
                ...
            </div>
        )
    }

    return (
        <PluginContent
            route={route}
            onRouteChange={setRoute}
            embedded
            locale={bridge.locale}
            onClose={() => bridge.requestClose()}
        />
    )
}

// Modo standalone: NUI propria, aberta via /plugintest. Sem bridge — accent
// e locale chegam direto no payload do setVisible.
function StandaloneMode() {
    const [open, setOpen] = useState(false)
    const [accentColor, setAccentColor] = useState('#00E699')
    const [locale, setLocale] = useState('pt-br')
    const [route, setRoute] = useState<Route>('home')

    useAccentColor(accentColor)

    useNuiEvent<{ visible: boolean; config?: { accentColor?: string }; locale?: string }>(
        'setVisible',
        (payload) => {
            setOpen(payload.visible)
            if (payload.config?.accentColor) setAccentColor(payload.config.accentColor)
            if (payload.locale) setLocale(payload.locale)
        }
    )

    useNuiEvent<{ accentColor: string }>('accentColorChanged', (payload) => {
        setAccentColor(payload.accentColor)
    })

    useEffect(() => {
        if (!open) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') fetchNui('closeUi', {})
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [open])

    if (!open) return null

    return (
        <MriTabletFrame size="lg">
            <div className="flex w-full h-full">
                <PluginContent
                    route={route}
                    onRouteChange={setRoute}
                    embedded={false}
                    locale={locale}
                    onClose={() => fetchNui('closeUi', {})}
                />
            </div>
        </MriTabletFrame>
    )
}

export default function App() {
    const isEmbedded = useIsEmbedded()
    return isEmbedded ? <EmbeddedMode /> : <StandaloneMode />
}
