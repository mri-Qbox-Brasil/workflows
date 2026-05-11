import { useEffect, useState } from 'react'
import { MriCard } from '@mriqbox/ui-kit'
import { Sparkles } from 'lucide-react'
import { fetchNui } from '../context/NuiContext'
import { useLocales } from '../hooks/useLocales'

interface PluginConfig {
    welcomeMessage?: string
    debug?: boolean
}

interface Props {
    locale?: string
}

/**
 * Hello-world do plugin. Em produção, troque por seu painel real.
 * Em dev (fora do FiveM), fetchNui falha e cai no fallback default.
 */
export function HelloPlugin({ locale }: Props) {
    const { t } = useLocales(locale)
    const [config, setConfig] = useState<PluginConfig>({})

    useEffect(() => {
        fetchNui<PluginConfig>('adminGetConfig')
            .then((data) => setConfig(data || {}))
            .catch(() => { /* dev fallback */ })
    }, [])

    // Custom `welcomeMessage` do config tem prioridade; senao usa traducao.
    const message = config.welcomeMessage || t('ui.welcome_default')

    return (
        <div className="mt-6 space-y-4">
            <MriCard className="p-8 flex flex-col items-center justify-center gap-4 text-center">
                <Sparkles className="w-12 h-12 text-primary" />
                <h2 className="text-2xl font-bold text-foreground">{message}</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                    {t('ui.welcome_subtitle', { file: 'PLUGINS.md' })}
                </p>
            </MriCard>
        </div>
    )
}
