import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  KanbanSquare,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  ShoppingCart,
  Tag,
  User,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ensureCurrentUserInSystemUsers } from '../../lib/userSync';
import { resolveDefaultSalesOpportunityStageId } from '../../lib/salesOpportunityStage';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { usePermissions } from '../../hooks/usePermissions';

type StageKey = 'prospect' | 'contacted' | 'meeting' | 'quote' | 'negotiation' | 'won' | 'lost';
type OpportunityStatus = 'open' | 'won' | 'lost' | 'archived';

interface OpportunityClient {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  status: string | null;
}

interface OpportunityConversation {
  id: string;
  session_id: string;
  source_channel: string | null;
  source_detail: string | null;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  page_url: string | null;
  created_at: string;
  last_message_at: string | null;
}

interface Opportunity {
  id: string;
  opportunity_number: string;
  client_id: string | null;
  conversation_id: string | null;
  title: string;
  stage: StageKey;
  status: OpportunityStatus;
  expected_amount: number | string;
  currency: string;
  probability: number | string;
  expected_close_date: string | null;
  source_channel: string | null;
  source_detail: string | null;
  assigned_to: string | null;
  created_by: string | null;
  metadata: Record<string, unknown> | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
  client?: OpportunityClient | null;
  conversation?: OpportunityConversation | null;
}

interface ClientOption {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
}

interface SystemUser {
  id: string;
  full_name: string;
  email: string;
  role: string | null;
  is_active: boolean | null;
}

interface TimelineItem {
  id: string;
  type: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

interface StageConfig {
  key: StageKey;
  label: string;
  shortLabel: string;
  badgeClass: string;
  columnClass: string;
}

const pipelineStages: StageConfig[] = [
  {
    key: 'prospect',
    label: 'Prospecto',
    shortLabel: 'Prospecto',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    columnClass: 'bg-slate-50/80 border-slate-200',
  },
  {
    key: 'contacted',
    label: 'Contactado',
    shortLabel: 'Contactado',
    badgeClass: 'bg-sky-100 text-sky-700 border-sky-200',
    columnClass: 'bg-sky-50/70 border-sky-200',
  },
  {
    key: 'meeting',
    label: 'Reunión',
    shortLabel: 'Reunión',
    badgeClass: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    columnClass: 'bg-indigo-50/70 border-indigo-200',
  },
  {
    key: 'quote',
    label: 'Cotización',
    shortLabel: 'Cotización',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
    columnClass: 'bg-amber-50/70 border-amber-200',
  },
  {
    key: 'negotiation',
    label: 'Negociación',
    shortLabel: 'Negociación',
    badgeClass: 'bg-violet-100 text-violet-700 border-violet-200',
    columnClass: 'bg-violet-50/70 border-violet-200',
  },
  {
    key: 'won',
    label: 'Ganado',
    shortLabel: 'Ganado',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    columnClass: 'bg-emerald-50/70 border-emerald-200',
  },
  {
    key: 'lost',
    label: 'Perdido',
    shortLabel: 'Perdido',
    badgeClass: 'bg-rose-100 text-rose-700 border-rose-200',
    columnClass: 'bg-rose-50/70 border-rose-200',
  },
];

const stageProbability: Record<StageKey, number> = {
  prospect: 20,
  contacted: 35,
  meeting: 50,
  quote: 65,
  negotiation: 80,
  won: 100,
  lost: 0,
};

const stageStatus: Record<StageKey, OpportunityStatus> = {
  prospect: 'open',
  contacted: 'open',
  meeting: 'open',
  quote: 'open',
  negotiation: 'open',
  won: 'won',
  lost: 'lost',
};

const interactionLabels: Record<string, string> = {
  opportunity_created: 'Oportunidad creada',
  quote_requested: 'Solicitud de cotización',
  quote_created: 'Cotización creada',
  stage_changed: 'Cambio de etapa',
  note: 'Nota',
  call: 'Llamada',
  email: 'Email',
  meeting: 'Reunión',
  quote_sent: 'Cotización enviada',
  quote_accepted: 'Cotización aceptada',
  quote_rejected: 'Cotización rechazada',
  quote_expired: 'Cotización vencida',
  quote_converted: 'Cotización convertida',
  task_created: 'Tarea creada',
  lead_created: 'Lead creado',
  order: 'Orden',
  invoice: 'Factura',
};

const formatCurrency = (value: number, currency: string) => {
  const safeCurrency = currency || 'USD';
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: safeCurrency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return new Intl.NumberFormat('es-ES', {
      maximumFractionDigits: 0,
    }).format(value);
  }
};

const formatDate = (value: string | null) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (value: string | null) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStageConfig = (stage: StageKey) => pipelineStages.find((item) => item.key === stage) || pipelineStages[0];

const getTimelineEventType = (item: TimelineItem) => {
  const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : null;
  const originalType = metadata && typeof metadata.original_type === 'string' ? metadata.original_type.trim() : '';
  return originalType || item.type;
};

const getInteractionTitle = (item: TimelineItem) => interactionLabels[getTimelineEventType(item)] || getTimelineEventType(item).replaceAll('_', ' ');

type ClientInteractionInsert = {
  client_id: string | null;
  opportunity_id?: string | null;
  quote_id?: string | null;
  conversation_id?: string | null;
  type: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

const isClientInteractionTypeConstraintError = (error: { message?: string } | null | undefined) => {
  const message = error?.message?.toLowerCase() ?? '';
  return (
    message.includes('client_interactions_type_check') ||
    message.includes('violates check constraint') ||
    message.includes('check constraint')
  );
};

const fallbackClientInteractionType = (type: string) => {
  if (type === 'quote_converted') return 'order';
  if (type === 'quote_sent') return 'email';
  return 'note';
};

const insertClientInteractionSafely = async (payload: ClientInteractionInsert) => {
  const { error } = await supabase.from('client_interactions').insert(payload as any);
  if (!error) {
    return { error: null, usedFallback: false };
  }

  if (!isClientInteractionTypeConstraintError(error)) {
    return { error, usedFallback: false };
  }

  const fallbackType = fallbackClientInteractionType(payload.type);
  const fallbackPayload = {
    ...payload,
    type: fallbackType,
    metadata: {
      ...(payload.metadata || {}),
      original_type: payload.type,
      fallback_type: fallbackType,
      fallback_reason: 'client_interactions_type_check',
    },
  };

  const { error: fallbackError } = await supabase.from('client_interactions').insert(fallbackPayload as any);
  return { error: fallbackError ?? null, usedFallback: true };
};

const defaultCreateForm = {
  client_id: '',
  title: '',
  stage: 'prospect' as StageKey,
  expected_amount: '',
  probability: '20',
  expected_close_date: '',
  source_channel: 'manual',
  source_detail: '',
  assigned_to: '',
  initial_note: '',
  client_search: '',
};

export function SalesPipelineModule() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [draggedOpportunityId, setDraggedOpportunityId] = useState<string | null>(null);
  const [dropTargetStage, setDropTargetStage] = useState<StageKey | null>(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [noteText, setNoteText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [createClientSearch, setCreateClientSearch] = useState('');
  const { user } = useAuth();
  const toast = useToast();
  const { canCreate, canUpdate } = usePermissions();
  const { setActiveModule } = useNavigation();
  const selectedOpportunityIdRef = useRef<string | null>(null);

  const selectedOpportunity = useMemo(
    () => opportunities.find((item) => item.id === selectedOpportunityId) || null,
    [opportunities, selectedOpportunityId]
  );

  const usersById = useMemo(() => {
    return users.reduce<Record<string, SystemUser>>((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }, [users]);

  const filteredClients = useMemo(() => {
    const query = createClientSearch.trim().toLowerCase();
    if (!query) return clients.slice(0, 40);
    return clients.filter((client) => {
      const haystack = [
        client.company_name,
        client.contact_name,
        client.email,
        client.phone || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    }).slice(0, 40);
  }, [clients, createClientSearch]);

  const filteredOpportunities = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return opportunities;
    return opportunities.filter((item) => {
      const haystack = [
        item.opportunity_number,
        item.title,
        item.source_detail || '',
        item.source_channel || '',
        item.client?.company_name || '',
        item.client?.contact_name || '',
        item.client?.email || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [opportunities, searchTerm]);

  const selectedStageOrder = useMemo(() => pipelineStages.map((item) => item.key), []);

  const metrics = useMemo(() => {
    const total = opportunities.length;
    const open = opportunities.filter((item) => item.status === 'open').length;
    const won = opportunities.filter((item) => item.status === 'won');
    const openValue = opportunities
      .filter((item) => item.status === 'open')
      .reduce((sum, item) => sum + Number(item.expected_amount || 0), 0);
    const weightedValue = opportunities.reduce((sum, item) => {
      const amount = Number(item.expected_amount || 0);
      const probability = Number(item.probability || 0);
      return sum + (amount * probability) / 100;
    }, 0);
    const wonValue = won.reduce((sum, item) => sum + Number(item.expected_amount || 0), 0);
    const conversionRate = total > 0 ? Math.round((won.length / total) * 100) : 0;
    return { total, open, openValue, weightedValue, wonValue, conversionRate };
  }, [opportunities]);

  const opportunitiesByStage = useMemo(() => {
    return pipelineStages.reduce<Record<StageKey, Opportunity[]>>((acc, stage) => {
      acc[stage.key] = filteredOpportunities
        .filter((item) => item.stage === stage.key)
        .sort((a, b) => {
          const aTime = new Date(a.updated_at || a.created_at).getTime();
          const bTime = new Date(b.updated_at || b.created_at).getTime();
          return bTime - aTime;
        });
      return acc;
    }, {
      prospect: [],
      contacted: [],
      meeting: [],
      quote: [],
      negotiation: [],
      won: [],
      lost: [],
    });
  }, [filteredOpportunities]);

  const loadPipelineData = useCallback(async () => {
    setLoading(true);

    const [
      { data: opportunitiesData, error: opportunitiesError },
      { data: clientsData, error: clientsError },
      { data: usersData, error: usersError },
    ] = await Promise.all([
      supabase
        .from('sales_opportunities')
        .select(`
          id,
          opportunity_number,
          client_id,
          conversation_id,
          title,
          stage,
          status,
          expected_amount,
          currency,
          probability,
          expected_close_date,
          source_channel,
          source_detail,
          assigned_to,
          created_by,
          metadata,
          last_activity_at,
          created_at,
          updated_at,
          client:clients!sales_opportunities_client_id_fkey (
            id,
            company_name,
            contact_name,
            email,
            phone,
            status
          ),
          conversation:webchat_conversations!sales_opportunities_conversation_id_fkey (
            id,
            session_id,
            source_channel,
            source_detail,
            visitor_name,
            visitor_email,
            visitor_phone,
            page_url,
            created_at,
            last_message_at
          )
        `)
        .order('updated_at', { ascending: false }),
      supabase
        .from('clients')
        .select('id, company_name, contact_name, email, phone')
        .order('company_name', { ascending: true }),
      supabase
        .from('system_users')
        .select('id, full_name, email, role, is_active')
        .eq('is_active', true)
        .order('full_name', { ascending: true }),
    ]);

    if (!opportunitiesError && opportunitiesData) {
      const nextOpportunities = opportunitiesData as Opportunity[];
      setOpportunities(nextOpportunities);

      const currentSelectedId = selectedOpportunityIdRef.current;
      if (!currentSelectedId && nextOpportunities.length > 0) {
        setSelectedOpportunityId(nextOpportunities[0].id);
      } else if (currentSelectedId && !nextOpportunities.some((item) => item.id === currentSelectedId)) {
        setSelectedOpportunityId(nextOpportunities[0]?.id || null);
      }
    }

    if (!clientsError && clientsData) {
      setClients(clientsData as ClientOption[]);
    }

    if (!usersError && usersData) {
      setUsers(usersData as SystemUser[]);
    }

    if (opportunitiesError) {
      toast.error(`No se pudieron cargar las oportunidades: ${opportunitiesError.message}`);
    }

    if (clientsError) {
      toast.error(`No se pudieron cargar los clientes: ${clientsError.message}`);
    }

    if (usersError) {
      toast.error(`No se pudieron cargar los usuarios: ${usersError.message}`);
    }

    setLoading(false);
  }, [toast]);

  const loadTimeline = useCallback(async (opportunityId: string) => {
    setTimelineLoading(true);
    const { data, error } = await supabase
      .from('client_interactions')
      .select('id, type, description, metadata, created_by, created_at')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTimeline(data as TimelineItem[]);
    } else if (error) {
      toast.error(`No se pudo cargar la actividad: ${error.message}`);
      setTimeline([]);
    }

    setTimelineLoading(false);
  }, [toast]);

  useEffect(() => {
    const initialize = async () => {
      await ensureCurrentUserInSystemUsers();
      await loadPipelineData();
    };

    initialize();
  }, [loadPipelineData]);

  useEffect(() => {
    selectedOpportunityIdRef.current = selectedOpportunityId;
  }, [selectedOpportunityId]);

  useEffect(() => {
    if (!selectedOpportunityId) {
      setTimeline([]);
      return;
    }

    void loadTimeline(selectedOpportunityId);

    const timelineChannel = supabase
      .channel(`pipeline-timeline-${selectedOpportunityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_interactions',
          filter: `opportunity_id=eq.${selectedOpportunityId}`,
        },
        () => {
          void loadTimeline(selectedOpportunityId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(timelineChannel);
    };
  }, [loadTimeline, selectedOpportunityId]);

  useEffect(() => {
    const opportunityChannel = supabase
      .channel('pipeline-opportunities')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales_opportunities',
        },
        () => {
          void loadPipelineData();
        }
      )
      .subscribe();

    const clientChannel = supabase
      .channel('pipeline-clients')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients',
        },
        () => {
          void loadPipelineData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(opportunityChannel);
      supabase.removeChannel(clientChannel);
    };
  }, [loadPipelineData]);

  useEffect(() => {
    if (!selectedOpportunityId) return;
    const current = opportunities.find((item) => item.id === selectedOpportunityId);
    if (!current && opportunities.length > 0) {
      setSelectedOpportunityId(opportunities[0].id);
    }
  }, [opportunities, selectedOpportunityId]);

  const currentOpportunity = selectedOpportunity;
  const currentStageIndex = currentOpportunity ? selectedStageOrder.indexOf(currentOpportunity.stage) : -1;

  const stageSummary = pipelineStages.map((stage) => {
    const items = opportunitiesByStage[stage.key] || [];
    const totalValue = items.reduce((sum, item) => sum + Number(item.expected_amount || 0), 0);
    return {
      ...stage,
      count: items.length,
      totalValue,
      items,
    };
  });

  const syncSelectedOpportunity = (id: string) => {
    setSelectedOpportunityId(id);
  };

  const handleCreateQuoteFromOpportunity = () => {
    if (!currentOpportunity) return;
    if (!canCreate('ventas')) {
      toast.error('No tienes permisos para crear cotizaciones');
      return;
    }

    try {
      localStorage.setItem(
        'sales_quote_draft',
        JSON.stringify({
          client_id: currentOpportunity.client_id || '',
          opportunity_id: currentOpportunity.id,
          quote_date: new Date().toISOString().slice(0, 10),
        })
      );
      setActiveModule('ventas');
      toast.success('Abrimos Ventas con la oportunidad lista para cotizar');
    } catch (error) {
      console.error('Error preparando cotizacion:', error);
      toast.error('No se pudo preparar la cotizacion');
    }
  };

  const persistOpportunityStage = async (opportunity: Opportunity, nextStage: StageKey) => {
    if (opportunity.stage === nextStage) return;
    if (!canUpdate('clientes')) {
      toast.error('No tienes permisos para mover oportunidades');
      return;
    }

    const now = new Date().toISOString();
    const nextStatus = stageStatus[nextStage];
    const nextProbability = stageProbability[nextStage];

    const { error: updateError } = await supabase
      .from('sales_opportunities')
      .update({
        stage: nextStage,
        status: nextStatus,
        probability: nextProbability,
        last_activity_at: now,
        updated_at: now,
      })
      .eq('id', opportunity.id);

    if (updateError) {
      toast.error(`No se pudo mover la oportunidad: ${updateError.message}`);
      return;
    }

    const { error: activityError } = await insertClientInteractionSafely({
      client_id: opportunity.client_id,
      opportunity_id: opportunity.id,
      conversation_id: opportunity.conversation_id,
      type: 'stage_changed',
      description: `Etapa cambiada de ${getStageConfig(opportunity.stage).label} a ${getStageConfig(nextStage).label}`,
      metadata: {
        old_stage: opportunity.stage,
        new_stage: nextStage,
        old_status: opportunity.status,
        new_status: nextStatus,
        source: 'pipeline_kanban',
      },
      created_by: user?.id || null,
      created_at: now,
    });

    if (activityError) {
      toast.error(`Se movió la oportunidad, pero no se pudo registrar la actividad: ${activityError.message}`);
    } else {
      toast.success(`Oportunidad movida a ${getStageConfig(nextStage).label}`);
    }

    await loadPipelineData();
    if (selectedOpportunityId === opportunity.id) {
      await loadTimeline(opportunity.id);
    }
  };

  const handleDropOnStage = async (stage: StageKey) => {
    setDropTargetStage(null);
    if (!draggedOpportunityId) return;

    const opportunity = opportunities.find((item) => item.id === draggedOpportunityId);
    setDraggedOpportunityId(null);

    if (!opportunity) return;
    await persistOpportunityStage(opportunity, stage);
  };

  const handleCreateOpportunity = async () => {
    if (!canCreate('clientes')) {
      toast.error('No tienes permisos para crear oportunidades');
      return;
    }

    if (!createForm.client_id) {
      toast.error('Selecciona un cliente');
      return;
    }

    if (!createForm.title.trim()) {
      toast.error('Escribe un título para la oportunidad');
      return;
    }

    const now = new Date().toISOString();
    const selectedClient = clients.find((item) => item.id === createForm.client_id) || null;
    const stageId = await resolveDefaultSalesOpportunityStageId();

    const { data, error } = await supabase
      .from('sales_opportunities')
      .insert({
        client_id: createForm.client_id,
        stage_id: stageId,
        contact_name: selectedClient?.contact_name || selectedClient?.company_name || 'Cliente',
        contact_email: selectedClient?.email || null,
        contact_phone: selectedClient?.phone || null,
        title: createForm.title.trim(),
        stage: createForm.stage,
        status: stageStatus[createForm.stage],
        amount: Number(createForm.expected_amount || 0),
        expected_amount: Number(createForm.expected_amount || 0),
        currency: 'USD',
        probability: Number(createForm.probability || stageProbability[createForm.stage]),
        expected_close_date: createForm.expected_close_date || null,
        source_channel: createForm.source_channel || 'manual',
        source_detail: createForm.source_detail.trim() || null,
        assigned_to: createForm.assigned_to || null,
        created_by: user?.id || null,
        metadata: {
          manual: true,
          initial_note: createForm.initial_note.trim() || null,
        },
        last_activity_at: now,
        created_at: now,
        updated_at: now,
      })
      .select(`
        id,
        opportunity_number,
        client_id,
        conversation_id,
        title,
        stage,
        status,
        expected_amount,
        currency,
        probability,
        expected_close_date,
        source_channel,
        source_detail,
        assigned_to,
        created_by,
        metadata,
        last_activity_at,
        created_at,
        updated_at,
        client:clients!sales_opportunities_client_id_fkey (
          id,
          company_name,
          contact_name,
          email,
          phone,
          status
        )
      `)
      .single();

    if (error || !data) {
      toast.error(`No se pudo crear la oportunidad: ${error?.message || 'error desconocido'}`);
      return;
    }

    const createdOpportunity = data as Opportunity;

    const { error: createdActivityError } = await insertClientInteractionSafely({
      client_id: createForm.client_id,
      opportunity_id: createdOpportunity.id,
      conversation_id: null,
      type: 'opportunity_created',
      description: 'Oportunidad creada manualmente',
      metadata: {
        manual: true,
        source_channel: createForm.source_channel,
        source_detail: createForm.source_detail || null,
        initial_note: createForm.initial_note || null,
      },
      created_by: user?.id || null,
      created_at: now,
    });

    if (createdActivityError) {
      toast.error(`La oportunidad fue creada, pero no se pudo registrar la actividad: ${createdActivityError.message}`);
    }

    if (createForm.initial_note.trim()) {
      await insertClientInteractionSafely({
        client_id: createForm.client_id,
        opportunity_id: createdOpportunity.id,
        conversation_id: null,
        type: 'note',
        description: createForm.initial_note.trim(),
        metadata: {
          manual: true,
        },
        created_by: user?.id || null,
        created_at: now,
      });
    }

    toast.success(`Oportunidad creada para ${selectedClient?.company_name || 'el cliente'}`);
    setCreateModalOpen(false);
    setCreateForm(defaultCreateForm);
    setCreateClientSearch('');
    await loadPipelineData();
    setSelectedOpportunityId(createdOpportunity.id);
    await loadTimeline(createdOpportunity.id);
  };

  const handleAddNote = async () => {
    if (!currentOpportunity) return;
    if (!noteText.trim()) {
      toast.error('Escribe una nota antes de guardarla');
      return;
    }

    const now = new Date().toISOString();
    const { error } = await insertClientInteractionSafely({
      client_id: currentOpportunity.client_id,
      opportunity_id: currentOpportunity.id,
      conversation_id: currentOpportunity.conversation_id,
      type: 'note',
      description: noteText.trim(),
      metadata: {
        source: 'pipeline_kanban',
      },
      created_by: user?.id || null,
      created_at: now,
    });

    if (error) {
      toast.error(`No se pudo guardar la nota: ${error.message}`);
      return;
    }

    toast.success('Nota guardada');
    setNoteText('');
    await loadTimeline(currentOpportunity.id);
    await loadPipelineData();
  };

  const moveSelectedOpportunity = async (direction: -1 | 1) => {
    if (!currentOpportunity) return;
    const nextIndex = currentStageIndex + direction;
    if (nextIndex < 0 || nextIndex >= selectedStageOrder.length) return;
    await persistOpportunityStage(currentOpportunity, selectedStageOrder[nextIndex]);
  };

  const markSelectedWonLost = async (stage: StageKey) => {
    if (!currentOpportunity) return;
    await persistOpportunityStage(currentOpportunity, stage);
  };

  const selectedClientName = currentOpportunity?.client?.company_name || currentOpportunity?.client?.contact_name || 'Sin cliente';
  const selectedAssignee = currentOpportunity?.assigned_to ? usersById[currentOpportunity.assigned_to] : null;
  const selectedConversation = currentOpportunity?.conversation || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              <KanbanSquare className="h-3.5 w-3.5" />
              Pipeline comercial
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900">
              Tablero de oportunidades
            </h1>
            <p className="mt-2 max-w-2xl text-sm sm:text-base text-slate-600">
              Mueve oportunidades entre etapas, registra notas y convierte solicitudes de cotización en ventas.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void loadPipelineData()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            {canCreate('clientes') && (
              <button
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4" />
                Nueva oportunidad
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Oportunidades</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <BarChart3 className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-900">{metrics.total.toLocaleString()}</div>
            <p className="mt-2 text-xs text-slate-500">Abiertas: {metrics.open.toLocaleString()}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Pipeline abierto</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-900">{formatCurrency(metrics.openValue, 'USD')}</div>
            <p className="mt-2 text-xs text-slate-500">Valor potencial inmediato</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Valor ponderado</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Tag className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-900">{formatCurrency(metrics.weightedValue, 'USD')}</div>
            <p className="mt-2 text-xs text-slate-500">Ajustado por probabilidad</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Conversión</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-900">{metrics.conversionRate}%</div>
            <p className="mt-2 text-xs text-slate-500">Ganadas: {formatCurrency(metrics.wonValue, 'USD')}</p>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, título, email o número de oportunidad"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:bg-white"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <FileText className="h-4 w-4" />
            Se muestran {filteredOpportunities.length} resultados filtrados
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <div className="flex gap-4 overflow-x-auto pb-2">
              {stageSummary.map((stage) => (
                <div
                  key={stage.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropTargetStage(stage.key);
                  }}
                  onDragLeave={() => {
                    if (dropTargetStage === stage.key) {
                      setDropTargetStage(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    void handleDropOnStage(stage.key);
                  }}
                  className={[
                    'min-w-[300px] flex-1 rounded-3xl border p-4 shadow-sm transition',
                    stage.columnClass,
                    dropTargetStage === stage.key ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-transparent' : '',
                  ].join(' ')}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">{stage.label}</h2>
                      <p className="text-xs text-slate-500">{stage.items.length} oportunidades</p>
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${stage.badgeClass}`}>
                      {formatCurrency(stage.totalValue, 'USD')}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {stage.items.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 text-center text-sm text-slate-500">
                        Sin oportunidades en esta etapa
                      </div>
                    ) : (
                      stage.items.map((opportunity) => {
                        const clientName = opportunity.client?.company_name || opportunity.client?.contact_name || 'Sin cliente';
                        const assignee = opportunity.assigned_to ? usersById[opportunity.assigned_to] : null;
                        const currentStage = getStageConfig(opportunity.stage);

                        return (
                          <button
                            key={opportunity.id}
                            type="button"
                            draggable
                            onDragStart={() => setDraggedOpportunityId(opportunity.id)}
                            onDragEnd={() => setDraggedOpportunityId(null)}
                            onClick={() => syncSelectedOpportunity(opportunity.id)}
                            className={[
                              'w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition',
                              'hover:-translate-y-0.5 hover:shadow-md',
                              selectedOpportunityId === opportunity.id ? 'border-sky-400 ring-2 ring-sky-100' : 'border-slate-200',
                            ].join(' ')}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                  {opportunity.opportunity_number}
                                </div>
                                <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                                  {opportunity.title}
                                </div>
                                <div className="mt-1 truncate text-xs text-slate-600">
                                  {clientName}
                                </div>
                              </div>
                              <div className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${currentStage.badgeClass}`}>
                                {currentStage.shortLabel}
                              </div>
                            </div>

                            <div className="mt-4 grid gap-2 text-xs text-slate-600">
                              <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1">
                                  <Tag className="h-3.5 w-3.5" />
                                  Valor
                                </span>
                                <strong className="text-slate-900">{formatCurrency(Number(opportunity.expected_amount || 0), opportunity.currency)}</strong>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1">
                                  <Sparkles className="h-3.5 w-3.5" />
                                  Probabilidad
                                </span>
                                <strong className="text-slate-900">{Number(opportunity.probability || 0)}%</strong>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  Cierre
                                </span>
                                <strong className="text-slate-900">{formatDate(opportunity.expected_close_date)}</strong>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {opportunity.source_channel && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                  {opportunity.source_channel}
                                </span>
                              )}
                              {assignee && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
                                  <User className="h-3 w-3" />
                                  {assignee.full_name}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              {currentOpportunity ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                        {currentOpportunity.opportunity_number}
                      </div>
                      <h3 className="mt-1 truncate text-lg font-bold text-slate-900">
                        {currentOpportunity.title}
                      </h3>
                      <div className="mt-1 text-sm text-slate-600">{selectedClientName}</div>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStageConfig(currentOpportunity.stage).badgeClass}`}>
                      {getStageConfig(currentOpportunity.stage).label}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Monto esperado</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {formatCurrency(Number(currentOpportunity.expected_amount || 0), currentOpportunity.currency)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Probabilidad</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {Number(currentOpportunity.probability || 0)}%
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Cierre estimado</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {formatDate(currentOpportunity.expected_close_date)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Responsable</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {selectedAssignee?.full_name || 'Sin asignar'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <MessageSquare className="h-4 w-4 text-slate-500" />
                      Origen
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500">Canal</span>
                        <strong className="text-right text-slate-900">{currentOpportunity.source_channel || 'manual'}</strong>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500">Detalle</span>
                        <strong className="max-w-[220px] text-right text-slate-900">{currentOpportunity.source_detail || 'Sin detalle'}</strong>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500">Actualizada</span>
                        <strong className="text-right text-slate-900">{formatDateTime(currentOpportunity.updated_at)}</strong>
                      </div>
                    </div>
                    {selectedConversation && (
                      <div className="mt-4 rounded-2xl bg-white p-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Conversación web</div>
                        <div className="mt-2 space-y-1 text-sm text-slate-700">
                          <div className="truncate">{selectedConversation.visitor_name || selectedConversation.visitor_email || 'Sin nombre'}</div>
                          <div className="truncate text-slate-500">{selectedConversation.page_url || 'Sin URL'}</div>
                          <div className="text-xs text-slate-400">Último mensaje: {formatDateTime(selectedConversation.last_message_at)}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-900">Movimiento rápido</h4>
                      <span className="text-xs text-slate-500">
                        Etapa {currentStageIndex + 1} de {selectedStageOrder.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => void moveSelectedOpportunity(-1)}
                        disabled={!canUpdate('clientes') || currentStageIndex <= 0}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Etapa anterior
                      </button>
                      <button
                        type="button"
                        onClick={() => void moveSelectedOpportunity(1)}
                        disabled={!canUpdate('clientes') || currentStageIndex >= selectedStageOrder.length - 1}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Etapa siguiente
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateQuoteFromOpportunity}
                        disabled={!canCreate('ventas')}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Crear cotización
                      </button>
                      <button
                        type="button"
                        onClick={() => void markSelectedWonLost('won')}
                        disabled={!canUpdate('clientes') || currentOpportunity.status === 'won'}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Ganar
                      </button>
                      <button
                        type="button"
                        onClick={() => void markSelectedWonLost('lost')}
                        disabled={!canUpdate('clientes') || currentOpportunity.status === 'lost'}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        Perder
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <FileText className="h-4 w-4 text-slate-500" />
                      Agregar nota
                    </div>
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      rows={4}
                      placeholder="Deja contexto para el equipo comercial..."
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-300"
                    />
                    <button
                      type="button"
                      onClick={() => void handleAddNote()}
                      disabled={!canUpdate('clientes')}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Guardar nota
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
                  <KanbanSquare className="h-10 w-10 text-slate-300" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">Selecciona una oportunidad</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Haz clic en una tarjeta para ver el detalle, las notas y la conversación relacionada.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">Historial</h4>
                {timelineLoading && <span className="text-xs text-slate-500">Cargando...</span>}
              </div>

              <div className="mt-4 space-y-3">
                {timeline.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    Sin actividad registrada todavía
                  </div>
                ) : (
                  timeline.map((item) => {
                    const label = getInteractionTitle(item);
                    const createdBy = item.created_by ? usersById[item.created_by]?.full_name || 'Sistema' : 'Sistema';
                    const description = item.description || '';
                    const metadata = item.metadata || {};
                    const oldStage = typeof metadata.old_stage === 'string' ? metadata.old_stage : null;
                    const newStage = typeof metadata.new_stage === 'string' ? metadata.new_stage : null;

                    return (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{label}</div>
                            <div className="mt-1 text-xs text-slate-500">{createdBy}</div>
                          </div>
                          <div className="text-[11px] text-slate-400">{formatDateTime(item.created_at)}</div>
                        </div>
                        {description && <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{description}</div>}
                        {oldStage && newStage && (
                          <div className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                            {getStageConfig(oldStage as StageKey).label} <span className="px-1">→</span> {getStageConfig(newStage as StageKey).label}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Nueva oportunidad</h3>
                <p className="mt-1 text-sm text-slate-500">Crea una oportunidad manual para el pipeline comercial.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateModalOpen(false);
                  setCreateForm(defaultCreateForm);
                  setCreateClientSearch('');
                }}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-5 px-6 py-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Cliente</label>
                  <div className="relative mt-2">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={createClientSearch}
                      onChange={(e) => setCreateClientSearch(e.target.value)}
                      placeholder="Buscar cliente..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-sky-300 focus:bg-white"
                    />
                  </div>
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                    {filteredClients.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-slate-500">No hay clientes que coincidan.</div>
                    ) : (
                      filteredClients.map((client) => {
                        const selected = createForm.client_id === client.id;
                        return (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => {
                              setCreateForm((prev) => ({
                                ...prev,
                                client_id: client.id,
                                title: prev.title || `${client.company_name || client.contact_name} - Oportunidad comercial`,
                              }));
                            }}
                            className={[
                              'flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0',
                              selected ? 'bg-sky-50' : 'hover:bg-slate-50',
                            ].join(' ')}
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900">{client.company_name || client.contact_name}</div>
                              <div className="mt-1 truncate text-xs text-slate-500">{client.email}</div>
                            </div>
                            {selected && <CheckCircle2 className="mt-0.5 h-4 w-4 text-sky-600" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Título</label>
                    <input
                      value={createForm.title}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-sky-300 focus:bg-white"
                      placeholder="Ej. Migración de hosting"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Etapa</label>
                    <select
                      value={createForm.stage}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, stage: e.target.value as StageKey }))}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-sky-300 focus:bg-white"
                    >
                      {pipelineStages.map((stage) => (
                        <option key={stage.key} value={stage.key}>
                          {stage.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Monto esperado</label>
                    <input
                      value={createForm.expected_amount}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, expected_amount: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-sky-300 focus:bg-white"
                      placeholder="0"
                      inputMode="decimal"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Probabilidad %</label>
                    <input
                      value={createForm.probability}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, probability: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-sky-300 focus:bg-white"
                      placeholder="20"
                      inputMode="numeric"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Fecha estimada de cierre</label>
                    <input
                      type="date"
                      value={createForm.expected_close_date}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, expected_close_date: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-sky-300 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Asignado a</label>
                    <select
                      value={createForm.assigned_to}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, assigned_to: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-sky-300 focus:bg-white"
                    >
                      <option value="">Sin asignar</option>
                      {users.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Canal</label>
                  <input
                    value={createForm.source_channel}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, source_channel: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-sky-300"
                    placeholder="manual"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Detalle de origen</label>
                  <input
                    value={createForm.source_detail}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, source_detail: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-sky-300"
                    placeholder="Landing, feria, referido, etc."
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Nota inicial</label>
                  <textarea
                    value={createForm.initial_note}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, initial_note: e.target.value }))}
                    rows={10}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-sky-300"
                    placeholder="Contexto adicional para el equipo comercial"
                  />
                </div>

                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-sky-800">
                    <Users className="h-4 w-4" />
                    Resumen
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-sky-900/80">
                    <div className="flex items-center justify-between gap-3">
                      <span>Cliente</span>
                      <span className="font-semibold">{clients.find((item) => item.id === createForm.client_id)?.company_name || 'Pendiente'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Etapa</span>
                      <span className="font-semibold">{getStageConfig(createForm.stage).label}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Probabilidad</span>
                      <span className="font-semibold">{createForm.probability || stageProbability[createForm.stage]}%</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleCreateOpportunity()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5"
                >
                  <Plus className="h-4 w-4" />
                  Crear oportunidad
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
