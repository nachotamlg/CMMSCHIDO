"use client"

import { TooltipContent } from "@/components/ui/tooltip"

import React from "react"

import { useState, useEffect, useCallback, useMemo, useRef } from "react" // Added useRef
import { formatDateForInput } from "@/lib/utils"
import { getDashboardStats, type DashboardStats } from "@/app/actions/dashboard"
import { fetchEquipos, saveEquipo, removeEquipo, fetchEquipoDetails, getEquipo, checkEquipoAssociations, type Equipo } from "@/app/actions/equipos"
import {
  fetchUsuarios,
  saveUsuario,
  removeUsuario,
  fetchUsuarioDetails,
  updatePermissions,
  resetPassword,
  toggleUserStatus,
  getUserActivity,
  type Usuario,
} from "@/app/actions/usuarios"
import { getHospitalLogo, setHospitalLogo as saveHospitalLogo } from "@/app/actions/configuracion"
import { SmartMaintenanceCalendar } from "@/components/smart-maintenance-calendar"
import { MonthlyMaintenanceCalendar } from "@/components/monthly-maintenance-calendar"
import { AbortableModuleLoader, deduplicateRequest, clearCache } from "@/lib/utils/module-loader"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Users,
  Wrench,
  SettingsIcon,
  RefreshCw,
  Bell,
  Settings,
  Filter,
  Eye,
  Edit,
  Trash2,
  Plus,
  Upload,
  Download,
  FileText,
  UserCheck,
  UserX,
  Key,
  Search,
  Activity,
  UserPlus,
  MoreVertical,
  Clock,
  XCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Building,
  X,
  Save,
  Briefcase,
  AlertCircle,
  AlertTriangle,
  Image as ImageIcon,
} from "lucide-react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Button } from "@/components/ui/button"
import { AppSidebar } from "@/components/app-sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CheckCircle2, LucideAlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"
import {
  fetchOrdenesTrabajo,
  saveOrdenTrabajo,
  removeOrdenTrabajo,
  asignarTecnicoAOrden,
  cambiarEstadoOrden,
  type OrdenTrabajo,
} from "./actions/ordenes-trabajo"
import {
  getAllMantenimientos,
  getMantenimientosStats,
  createMantenimiento, // Imported createMantenimiento
  updateMantenimiento, // Imported updateMantenimiento
  deleteMantenimiento, // Imported deleteMantenimiento
  checkUpcomingMaintenances,
  completeMantenimiento, // Imported completeMantenimiento
} from "./actions/mantenimientos"

import type { Mantenimiento } from "@/lib/api/mantenimientos"
import { generatePDF, downloadPDF, generateEquipmentTechnicalSheet, generateWorkOrderPDF } from "@/lib/pdf-generator" // Added generateEquipmentTechnicalSheet, generateWorkOrderPDF
import { canAccessSection, type CurrentUser, type RoleType, type PermissionKey, DEFAULT_PERMISSIONS_BY_ROLE } from "@/lib/utils/permissions" // Import DEFAULT_PERMISSIONS_BY_ROLE
import { fetchAuditLogs } from "@/app/actions/logs"
import { type Notification } from "@/app/actions/notificaciones"
import { Alert, AlertDescription } from "@/components/ui/alert" // Added Alert component
import { EquipmentCombobox } from "@/components/equipment-combobox"
import { useToast } from "@/components/ui/use-toast" // Imported toast
import { AppHeader } from "@/components/app-header" // Imported AppHeader
import { getDocumentoUrl } from "@/lib/api/documentos" // Imported getDocumentoUrl
// This feature was causing issues with the Laravel backend
// Notifications will still be created when maintenances are created/updated
// import { checkUpcomingMaintenances } from "@/lib/api/mantenimientos"

// ADDED: Helper function to format dates to DD-MM-YYYY
function formatDate(dateString: string | Date | undefined | null): string {
  if (!dateString) return "-"

  try {
    let date: Date
    if (typeof dateString === 'string') {
      // Handle ISO date strings (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
      const parts = dateString.split('T')[0].split('-')
      if (parts.length === 3) {
        date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
      } else {
        date = new Date(dateString)
      }
    } else {
      date = new Date(dateString)
    }
    
    if (isNaN(date.getTime())) return "-"

    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const year = date.getFullYear()

    return `${day}-${month}-${year}`
  } catch (error) {
    console.error('[v0] Error in formatDate:', error)
    return "-"
  }
}

// Mock users for authentication simulation
const mockUsers: Usuario[] = [
  {
    id: 1,
    nombre: "Admin User",
    email: "admin@hospital.com",
    rol: "Administrador",
    activo: true,
    estado: "Activo",
    permissions: {
      gestionEquipos: true,
      gestionUsuarios: true,
      ordenesTrabajoCrear: true,
      ordenesTrabajoAsignar: true,
      ordenesTrabajoEjecutar: true,
      mantenimientoPreventivo: true,
      reportesGenerar: true,
      reportesVer: true,
      logsAcceso: true,
      configuracionSistema: true,
    },
  },
  {
    id: 2,
    nombre: "Supervisor User",
    email: "supervisor@hospital.com",
    rol: "Supervisor",
    activo: true,
    estado: "Activo",
    permissions: {
      gestionEquipos: true,
      gestionUsuarios: false,
      ordenesTrabajoCrear: true,
      ordenesTrabajoAsignar: true,
      ordenesTrabajoEjecutar: true,
      mantenimientoPreventivo: true,
      reportesGenerar: true,
      reportesVer: true,
      logsAcceso: false,
      configuracionSistema: false,
    },
  },
  {
    id: 3,
    nombre: "Technician User",
    email: "technician@hospital.com",
    rol: "Técnico",
    activo: true,
    estado: "Activo",
    permissions: {
      gestionEquipos: false,
      gestionUsuarios: false,
      ordenesTrabajoCrear: false,
      ordenesTrabajoAsignar: false,
      ordenesTrabajoEjecutar: true,
      mantenimientoPreventivo: true,
      reportesGenerar: false,
      reportesVer: true,
      logsAcceso: false,
      configuracionSistema: false,
    },
  },
]

type Equipment = {
  id: number
  numeroSerie: string
  nombre: string
  modelo: string
  fabricante: string
  ubicacion: string
  estado: string
  voltaje: string
  fechaInstalacion: string
  frecuencia?: string
  fechaRetiro?: string
  codigoInstitucional?: string
  servicio?: string
  vencimientoGarantia?: string
  fechaIngreso?: string
  procedencia?: string
  potencia?: string
  corriente?: string
  otrosEspecificaciones?: string
  accesoriosConsumibles?: string
  estadoEquipo?: string
  manualUsuario?: boolean
  manualServicio?: boolean
  nivelRiesgo?: string
  proveedorNombre?: string
  proveedorDireccion?: string
  proveedorTelefono?: string
  observaciones?: string
  documentos?: Array<{
    id?: number // Added id for delete handler
    nombre: string
    tipo: string
    fechaSubida?: string
    url?: string // Added url for view handler
  }>
}

function transformEquipoToEquipment(equipo: Equipo | any): Equipment {
  // Extract specifications from JSON if they exist
  const specs = equipo.especificaciones || {}
  
  return {
    id: equipo.id,
    numeroSerie: equipo.numero_serie || "",
    nombre: equipo.nombre || "",
    modelo: equipo.modelo || "",
    fabricante: equipo.marca || "",
    ubicacion: equipo.ubicacion || "",
    estado: equipo.estado || "operativo",
    voltaje: specs.voltaje || "",
    fechaInstalacion: specs.fechaInstalacion || "",
    frecuencia: specs.frecuencia || "",
    fechaRetiro: equipo.fecha_adquisicion || "",
    codigoInstitucional: equipo.codigo || "",
    servicio: specs.servicio,
    vencimientoGarantia: specs.vencimientoGarantia,
    fechaIngreso: equipo.fecha_adquisicion,
    procedencia: specs.procedencia,
    potencia: specs.potencia,
    corriente: specs.corriente,
    otrosEspecificaciones: specs.otrosEspecificaciones,
    accesoriosConsumibles: specs.accesoriosConsumibles,
    estadoEquipo: specs.estadoEquipo,
    manualUsuario: specs.manualUsuario ?? false,
    manualServicio: specs.manualServicio ?? false,
    nivelRiesgo: specs.nivelRiesgo,
    proveedorNombre: specs.proveedorNombre,
    proveedorDireccion: specs.proveedorDireccion,
    proveedorTelefono: specs.proveedorTelefono,
    observaciones: equipo.descripcion,
    documentos: equipo.documentos || [], // Initialize as empty array
  }
}

function transformEquipmentToEquipo(equipment: Partial<Equipment>): Partial<Equipo> {
  return {
    id: equipment.id,
    codigo: equipment.codigoInstitucional || `EQ-${Date.now()}`,
    nombre: equipment.nombre,
    tipo: "Médico", // Default type - can be adjusted based on form input
    marca: equipment.fabricante,
    modelo: equipment.modelo,
    numero_serie: equipment.numeroSerie,
    ubicacion: equipment.ubicacion,
    estado: equipment.estado || "operativo",
    criticidad: "media", // Default criticality - can be adjusted based on form input
    descripcion: equipment.observaciones,
    especificaciones: {
      // Electrical specifications
      voltaje: equipment.voltaje,
      frecuencia: equipment.frecuencia,
      potencia: equipment.potencia,
      corriente: equipment.corriente,
      // Additional specifications
      servicio: equipment.servicio,
      procedencia: equipment.procedencia,
      otrosEspecificaciones: equipment.otrosEspecificaciones,
      accesoriosConsumibles: equipment.accesoriosConsumibles,
      // Equipment condition
      estadoEquipo: equipment.estadoEquipo,
      nivelRiesgo: equipment.nivelRiesgo,
      // Documentation
      manualUsuario: equipment.manualUsuario,
      manualServicio: equipment.manualServicio,
      // Warranty and dates
      vencimientoGarantia: equipment.vencimientoGarantia,
      fechaInstalacion: equipment.fechaInstalacion,
      // Supplier information
      proveedorNombre: equipment.proveedorNombre,
      proveedorTelefono: equipment.proveedorTelefono,
      proveedorDireccion: equipment.proveedorDireccion,
    },
    fecha_adquisicion: equipment.fechaIngreso || equipment.fechaRetiro,
    valor_adquisicion: null,
    vida_util_anos: null,
    ultima_mantencion: null,
    proxima_mantencion: null,
    horas_operacion: null,
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const { toast } = useToast() // Initialize toast
  
  // Module loaders with abort capability
  const equipmentLoaderRef = useRef(new AbortableModuleLoader("equipos"))
  const usersLoaderRef = useRef(new AbortableModuleLoader("usuarios"))
  const maintenanceLoaderRef = useRef(new AbortableModuleLoader("mantenimiento"))
  const ordersLoaderRef = useRef(new AbortableModuleLoader("ordenes"))
  
  const [activeSection, setActiveSection] = useState("dashboard")
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true) // Moved loading state here
  const [equipmentLoading, setEquipmentLoading] = useState(false)
  const [equipmentFilters, setEquipmentFilters] = useState({
    estado: "all",
    ubicacion: "all",
    fabricante: "all",
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalEquipment, setTotalEquipment] = useState(0)
  const [perPage, setPerPage] = useState(10)

  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [showEquipmentForm, setShowEquipmentForm] = useState(false)
  const [showEquipmentDetails, setShowEquipmentDetails] = useState(false)
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
  const [equipmentForm, setEquipmentForm] = useState<Partial<Equipment>>({
    estado: "operativo",
    ubicacion: "uci",
  })
  // CHANGE: Add state for editing equipment
  const [editingEquipment, setEditingEquipment] = useState(false)

  const [users, setUsers] = useState<Usuario[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userFilters, setUserFilters] = useState({
    rol: "all",
    estado: "all",
  })
  const [showUserForm, setShowUserForm] = useState(false) // Renamed from showUserDialog
  const [showUserDetails, setShowUserDetails] = useState(false)
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null) // CHANGE: Renamed to match the type
  const [editingUser, setEditingUser] = useState<Usuario | null>(null)
  const [editingPermissions, setEditingPermissions] = useState<Usuario | null>(null)
  const [newUser, setNewUser] = useState<Partial<Usuario> & { contrasena?: string }>({
    estado: "Activo",
  })
  const [userPermissions, setUserPermissions] = useState({
    gestionEquipos: false,
    gestionUsuarios: false,
    ordenesTrabajoCrear: false,
    ordenesTrabajoAsignar: false,
    ordenesTrabajoEjecutar: true,
    mantenimientoPreventivo: true,
    reportesGenerar: false,
    reportesVer: true,
    logsAcceso: false,
    configuracionSistema: false,
  })
  const [userRole, setUserRole] = useState<RoleType>("administrador") // Changed to RoleType

  const [userSearchTerm, setUserSearchTerm] = useState("")
  const [usersPaginaActual, setUsersPaginaActual] = useState(1)
  const [usersPerPage, setUsersPerPage] = useState(10)
  const [usersTotalPages, setUsersTotalPages] = useState(1) // Initialize with 1

  const [loadingUserActivity, setLoadingUserActivity] = useState(false)
  const [userActivity, setUserActivity] = useState<any>(null)

  const [maintenanceSchedules, setMaintenanceSchedules] = useState<Mantenimiento[]>([])
  const [maintenanceLoading, setMaintenanceLoading] = useState(false)
  const [maintenanceStats, setMaintenanceStats] = useState({
    vencidos: 0,
    proximos: 0,
    completados: 0,
    total: 0,
  })
  const [maintenanceFilters, setMaintenanceFilters] = useState({
    tipo: "all",
    frecuencia: "all",
  })
  const [maintenanceSearchTerm, setMaintenanceSearchTerm] = useState("")
  const [calendarView, setCalendarView] = useState(false) // State to toggle between list and calendar view
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false)
  const [showMaintenanceDetails, setShowMaintenanceDetails] = useState(false)
  const [selectedMaintenance, setSelectedMaintenance] = useState<Mantenimiento | null>(null)
  const [maintenanceFormErrors, setMaintenanceFormErrors] = useState<Record<string, string>>({}) // ADDED
  // CHANGE: Removed default values from frecuencia field
  const [maintenanceForm, setMaintenanceForm] = useState<Partial<Mantenimiento>>({})

  const [workOrders, setWorkOrders] = useState<OrdenTrabajo[]>([])
  const [orderFilters, setOrderFilters] = useState({
    estado: "all",
    prioridad: "all",
    tipo: "all",
    fechaDesde: "",
    fechaHasta: "",
  })
  const [searchOrder, setSearchOrder] = useState("")
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<OrdenTrabajo | null>(null)
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false)
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [newOrderData, setNewOrderData] = useState<Partial<OrdenTrabajo>>({
    tipo: "Preventivo",
    prioridad: "media",
    estado: "abierta",
    fechaCreacion: new Date().toISOString().split("T")[0],
  })
  const [orderCurrentPage, setOrderCurrentPage] = useState(1) // Renamed to avoid conflict
  const [orderTotalPages, setOrderTotalPages] = useState(1) // Renamed to avoid conflict
  const [orderPerPage, setOrderPerPage] = useState(10) // Renamed to avoid conflict
  const [orderTotalRecords, setOrderTotalRecords] = useState(0) // Total records across all pages
  const [isLoadingOrders, setIsLoadingOrders] = useState(false) // CHANGE: Add loading state for orders

  const [selectedTechnicianId, setSelectedTechnicianId] = useState<number | null>(null)
  const [newStatus, setNewStatus] = useState("") // ADDED: State for new status in change status dialog

  // CHANGE: Updated report type to include cronograma
  const [reportType, setReportType] = useState<"equipos" | "mantenimientos" | "ordenes" | "cronograma" | "usuarios">("equipos")
  const [reportFechaInicio, setReportFechaInicio] = useState("")
  const [reportFechaFin, setReportFechaFin] = useState("")
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [authChecked, setAuthChecked] = useState(false) // NEW: Track if auth has been checked

  // ADDED: Audit log states
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [logSearchTerm, setLogSearchTerm] = useState("")
  const [logActionFilter, setLogActionFilter] = useState("all")
  const [logCurrentPage, setLogCurrentPage] = useState(1)
  const [logsLoading, setLogsLoading] = useState(false)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const logsPerPage = 10

  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = React.useState(0)

  // ADDED: Configuration states
  const [configLocations, setConfigLocations] = useState<string[]>([
    "UCI",
    "Emergencias",
    "Cirugía",
    "Radiología",
    "Laboratorio",
  ])
  const [configManufacturers, setConfigManufacturers] = useState<string[]>([
    "Philips",
    "GE Healthcare",
    "Siemens",
    "Medtronic",
  ])
  const [newLocation, setNewLocation] = useState("")
  const [newManufacturer, setNewManufacturer] = useState("")

  const [isMounted, setIsMounted] = useState(false)

  // ADDED: Error states for form validation
  const [orderFormErrors, setOrderFormErrors] = useState<Record<string, string>>({})
  const [equipmentFormErrors, setEquipmentFormErrors] = useState<Record<string, string>>({})
  const [userFormErrors, setUserFormErrors] = useState<Record<string, string>>({})
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetPasswordUser, setResetPasswordUser] = useState<Usuario | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [hospitalLogo, setHospitalLogo] = useState<string>("") // Declare hospitalLogo state

  // CHANGE: Add state for delete confirmation dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedOrderToDelete, setSelectedOrderToDelete] = useState<number | null>(null)

  // CHANGE: Add state for equipment delete confirmation dialog
  const [isDeleteEquipmentDialogOpen, setIsDeleteEquipmentDialogOpen] = useState(false)
  const [selectedEquipmentToDelete, setSelectedEquipmentToDelete] = useState<number | null>(null)

  // CHANGE: Add state for user delete confirmation dialog
  const [isDeleteUserDialogOpen, setIsDeleteUserDialogOpen] = useState(false)
  const [selectedUserToDelete, setSelectedUserToDelete] = useState<number | null>(null)

  // CHANGE: Add state for maintenance delete confirmation dialog
  const [isDeleteMaintenanceDialogOpen, setIsDeleteMaintenanceDialogOpen] = useState(false)
  const [selectedMaintenanceToDelete, setSelectedMaintenanceToDelete] = useState<number | null>(null)



  // CHANGE: Moved layout and navigation logic to AppHeader and AppSidebar components
  const [currentView, setCurrentView] = useState("dashboard")
  const [activeTab, setActiveTab] = useState("dashboard") // Not used in the main logic, can be removed or integrated

  // ADDED: State to store equipment associations (maintenances and work orders)
  const [equipmentAssociations, setEquipmentAssociations] = useState<
    Record<
      number,
      {
        hasMaintenances: boolean
        hasWorkOrders: boolean
        maintenanceCount: number
        workOrderCount: number
      }
    >
  >({})

  // Moved useEffect hooks to the top level
  useEffect(() => {
    setIsMounted(true)
    // Load hospital logo from database
    getHospitalLogo().then((logo) => {
      if (logo) {
        setHospitalLogo(logo)
      }
    }).catch((error) => {
      console.error("[v0] Error loading hospital logo:", error)
    })
  }, [])

  // Cleanup: abort all pending requests when component unmounts or section changes
  useEffect(() => {
    return () => {
      console.log("[v0] Component cleanup - aborting pending module loads")
      equipmentLoaderRef.current.abort()
      usersLoaderRef.current.abort()
      maintenanceLoaderRef.current.abort()
      ordersLoaderRef.current.abort()
    }
  }, [])

  // Sync form when editing user changes
  useEffect(() => {
    if (editingUser) {
      setNewUser({
        id: editingUser.id,
        nombre: editingUser.nombre,
        email: editingUser.email,
        rol: editingUser.rol,
        estado: editingUser.estado || "Activo",
      })
      setUserFormErrors({})
    }
  }, [editingUser])

  const loadEquipment = useCallback(async () => {
    console.log("[v0] loadEquipment - Starting with filters:", { currentPage, perPage, searchTerm, equipmentFilters })
    setEquipmentLoading(true)
    
    try {
      const params = {
        page: currentPage,
        per_page: perPage,
        search: searchTerm || undefined,
        estado: equipmentFilters.estado !== "all" ? equipmentFilters.estado : undefined,
        ubicacion: equipmentFilters.ubicacion !== "all" ? equipmentFilters.ubicacion : undefined,
        fabricante: equipmentFilters.fabricante !== "all" ? equipmentFilters.fabricante : undefined,
      }

      // Use deduplicated request to avoid concurrent calls
      const response = await deduplicateRequest(
        `equipos_${JSON.stringify(params)}`,
        () => fetchEquipos(params),
        3 * 60 * 1000 // 3 minute cache
      )
      
      console.log("[v0] loadEquipment - Full response:", response)
      const transformedEquipment = response.data.map(transformEquipoToEquipment)
      setEquipment(transformedEquipment)
      setTotalEquipment(response.total)
      console.log("[v0] loadEquipment - Successfully loaded", transformedEquipment.length, "items, totalEquipment set to", response.total)
    } catch (error) {
      console.error("[v0] loadEquipment - Error:", error)
      // If it fails, use mock data as a fallback
      setEquipment([
        {
          id: 1,
          numeroSerie: "SV-2023-001",
          nombre: "Monitor de Signos Vitales",
          modelo: "IntelliVue MX450",
          fabricante: "Philips",
          ubicacion: "UCI - Piso 3",
          estado: "operativo",
          voltaje: "110-240V",
          fechaInstalacion: "2023-01-15",
          frecuencia: "60Hz",
          documentos: [
            {
              nombre: "Manual_Usuario.pdf",
              tipo: "Manual",
              fechaSubida: "2023-01-15",
              url: "/files/manual_usuario.pdf",
            },
            {
              nombre: "Certificado_Calibracion.pdf",
              tipo: "Certificado",
              fechaSubida: "2024-11-15",
              url: "/files/certificado_calibracion.pdf",
            },
          ],
        },
      ])
      // Ensure totalEquipment is set even with mock data
      setTotalEquipment(1)
    } finally {
      setEquipmentLoading(false)
    }
  }, [currentPage, perPage, searchTerm, equipmentFilters])

  // Define loadWorkOrders before useEffect hooks that use it
  const loadWorkOrders = useCallback(async () => {
    console.log("[v0] loadWorkOrders - Starting with filters:", { orderCurrentPage, orderPerPage, searchOrder, orderFilters })
    setIsLoadingOrders(true)
    
    try {
      const params = {
        estado: orderFilters.estado !== "all" ? orderFilters.estado : undefined,
        prioridad: orderFilters.prioridad !== "all" ? orderFilters.prioridad : undefined,
        tipo: orderFilters.tipo !== "all" ? orderFilters.tipo : undefined,
        fechaDesde: orderFilters.fechaDesde || undefined,
        fechaHasta: orderFilters.fechaHasta || undefined,
        search: searchOrder || undefined,
        page: orderCurrentPage, // Use renamed state
        perPage: orderPerPage, // Use renamed state
      }

      // Use deduplicated request to avoid concurrent calls
      const cacheKey = `ordenes_${JSON.stringify(params)}`
      console.log("[v0] loadWorkOrders - Cache key:", cacheKey)
      
      const response = await deduplicateRequest(
        cacheKey,
        () => fetchOrdenesTrabajo(params),
        3 * 60 * 1000 // 3 minute cache
      )

      console.log("[v0] loadWorkOrders - API Response:", response)
      
      // Ensure response has the correct structure
      if (!response || !response.data) {
        console.error("[v0] loadWorkOrders - Invalid response structure:", response)
        setWorkOrders([])
        setOrderTotalPages(1)
        return
      }
      
      setWorkOrders(response.data)
      setOrderTotalPages(response.lastPage) // Use renamed state
      setOrderTotalRecords(response.total || 0) // Store total records
      console.log("[v0] loadWorkOrders - Successfully loaded", response.data?.length ?? 0, "items, total:", response.total)
    } catch (error) {
      console.error("[v0] loadWorkOrders - Error:", error)
      setWorkOrders([])
    } finally {
      setIsLoadingOrders(false)
    }
  }, [orderCurrentPage, orderPerPage, searchOrder, orderFilters])

  // Initial load of equipment data when the component mounts.
  useEffect(() => {
    console.log("[v0] Component mounted - loading initial data")
    loadEquipment()
  }, [loadEquipment])

  // Re-load equipment data when the 'equipos' section becomes active.
  useEffect(() => {
    if (activeSection === "equipos") {
      console.log("[v0] Section changed to equipos - loading data")
      loadEquipment()
    }
  }, [activeSection, loadEquipment])

  // Re-load equipment data when pagination or filters change
  useEffect(() => {
    if (activeSection === "equipos") {
      console.log("[v0] Equipment pagination changed - reloading data", { currentPage, perPage, activeSection })
      loadEquipment()
    }
  }, [currentPage, perPage, equipmentFilters, searchTerm, activeSection, loadEquipment])

  // Initial load of work orders data when the component mounts.
  useEffect(() => {
    console.log("[v0] Component mounted - loading initial work orders")
    loadWorkOrders()
  }, [loadWorkOrders])

  const checkAndCreateWorkOrdersForMaintenance = async (mantenimientos: Mantenimiento[]) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(today.getDate() + 7)

    for (const m of mantenimientos) {
      try {
        let proximaFecha: Date
        if (typeof m.proximaFecha === 'string') {
          const parts = m.proximaFecha.split('T')[0].split('-')
          if (parts.length === 3) {
            proximaFecha = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
          } else {
            proximaFecha = new Date(m.proximaFecha)
          }
        } else {
          proximaFecha = new Date(m.proximaFecha)
        }
        
        proximaFecha.setHours(0, 0, 0, 0)
        const diasFaltantes = Math.ceil((proximaFecha.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        // If 7 days or less and date is in the future
        const resultado = m.resultado?.toLowerCase()
        if (diasFaltantes <= 7 && diasFaltantes > 0 && resultado === "pendiente") {
          console.log(`[v0] Mantenimiento ${m.id} necesita orden de trabajo. Faltan ${diasFaltantes} días`)
          // TODO: Implement actual work order creation if needed, based on existing logic.
          // For now, this is a placeholder for the check.
        }
      } catch (error) {
        console.error('[v0] Error checking maintenance dates:', error)
      }
    }
  }

  // ADDED: Load audit logs from backend when section becomes active
  // Load initial audit logs when section changes
  useEffect(() => {
    if (activeSection === "auditoria") {
      loadAuditLogs()
    }
  }, [activeSection])

  // Debounce search term (wait 500ms after user stops typing)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(logSearchTerm)
    }, 500)

    return () => clearTimeout(timer)
  }, [logSearchTerm])

  // Load audit logs when debounced search or filter changes
  useEffect(() => {
    if (activeSection === "auditoria") {
      loadAuditLogs()
    }
  }, [debouncedSearchTerm, logActionFilter, activeSection])

  const loadAuditLogs = async () => {
    try {
      setLogsLoading(true)
      console.log("[v0] loadAuditLogs - Calling fetchAuditLogs with:", { search: debouncedSearchTerm, action: logActionFilter })
      
      const result = await fetchAuditLogs(debouncedSearchTerm, logActionFilter, 1000)
      console.log("[v0] loadAuditLogs - Response:", result)
      
      // Extract logs data from response
      let logsData: any[] = []
      
      if (result && result.data && Array.isArray(result.data)) {
        // Response format: { success: true, data: [...] }
        logsData = result.data
      } else if (Array.isArray(result)) {
        // Direct array response
        logsData = result
      }
      
      console.log("[v0] loadAuditLogs - Loaded logs count:", logsData.length)
      setAuditLogs(logsData)
      setLogCurrentPage(1) // Reset to first page when filters change
    } catch (error) {
      console.error("[v0] loadAuditLogs - Error:", error)
      setAuditLogs([])
      toast({
        title: "Error",
        description: "Error al cargar los registros de auditoría.",
        variant: "destructive",
      })
    } finally {
      setLogsLoading(false)
    }
  }

  // Authentication check and user data loading
  const checkAuthentication = async () => {
    await new Promise((resolve) => setTimeout(resolve, 200))

    const isAuthenticated = localStorage.getItem("isAuthenticated")
    const userEmail = localStorage.getItem("userEmail")
    const storedUserId = localStorage.getItem("userId")

    if (!isAuthenticated || !userEmail) {
      router.push("/auth/login")
      return
    }

    try {
      const response = await fetchUsuarios()
      const usuarios = response.data

      const userData = usuarios.find((u: any) => u.correo === userEmail)
      if (userData) {
        const roletype = userData.rol.toLowerCase() as RoleType
        const permissions = (userData.permissions as Record<PermissionKey, boolean> | undefined) || DEFAULT_PERMISSIONS_BY_ROLE[roletype]
        const currentUserWithPermissions: CurrentUser = {
          id: userData.id,
          nombre: userData.nombre,
          email: userEmail,
          rol: roletype,
          permissions,
        }
        setCurrentUser(currentUserWithPermissions)
        setUserRole(roletype)
      } else {
        const storedRole = (localStorage.getItem("userRole") as RoleType) || "tecnico"
        const storedName = localStorage.getItem("userName") || "Usuario"
        const userId = storedUserId ? Number.parseInt(storedUserId) : 0
        if (userId === 0) {
          localStorage.clear()
          router.push("/auth/login")
          return
        }
        const currentUserWithPermissions: CurrentUser = {
          id: userId,
          nombre: storedName,
          email: userEmail,
          rol: storedRole,
          permissions: DEFAULT_PERMISSIONS_BY_ROLE[storedRole],
        }
        setCurrentUser(currentUserWithPermissions)
        setUserRole(storedRole)
      }
    } catch (error) {
      const storedRole = (localStorage.getItem("userRole") as RoleType) || "tecnico"
      const storedName = localStorage.getItem("userName") || "Usuario"
      const userId = storedUserId ? Number.parseInt(storedUserId) : 0
      if (userId === 0) {
        localStorage.clear()
        router.push("/auth/login")
        return
      }
      const currentUserWithPermissions: CurrentUser = {
        id: userId,
        nombre: storedName,
        email: userEmail,
        rol: storedRole,
        permissions: DEFAULT_PERMISSIONS_BY_ROLE[storedRole],
      }
      setCurrentUser(currentUserWithPermissions)
      setUserRole(storedRole)
    }
    
    // Mark auth check as complete
    setAuthChecked(true)
  }

  useEffect(() => {
    checkAuthentication()
  }, [])

  // Moved useEffect hooks to the top level
  // Update total user pages and reset current page if it becomes invalid
  useEffect(() => {
    const totalPages = Math.ceil(users.length / usersPerPage) // Use users.length directly as it's already paginated for display
    setUsersTotalPages(totalPages)
    if (usersPaginaActual > totalPages && totalPages > 0) {
      setUsersPaginaActual(1)
    }
  }, [users, usersPerPage, usersPaginaActual, setUsersTotalPages, setUsersPaginaActual])

  // Moved useEffect hooks to the top level
  // Load notifications when the component mounts and when currentUser changes
  useEffect(() => {
    if (currentUser?.id) {
      console.log("[v0] Loading notifications for user:", currentUser.id)
      loadNotifications()
    }
  }, [currentUser?.id])

  // Define loadNotifications here so it can be used in useEffect below
  const loadNotifications = async () => {
    try {
      const { getNotificationsForUser } = await import("@/app/actions/notificaciones")
      const notifs = await getNotificationsForUser(currentUser?.id)
      setNotifications(notifs)
      setUnreadCount(notifs.filter((n) => !n.leida).length)
      console.log("[v0] Loaded notifications:", notifs.length, "for user:", currentUser?.id)
    } catch (error) {
      console.error("[v0] Error loading notifications:", error)
      setNotifications([])
      setUnreadCount(0)
    }
  }

  useEffect(() => {
    const checkMaintenances = async () => {
      try {
        console.log("[v0] Checking maintenance notifications...")
        // Generate automatic maintenance notifications
        const { generateMaintenanceNotifications } = await import("@/app/actions/notificaciones")
        const result = await generateMaintenanceNotifications()
        
        console.log("[v0] Generated", result.notificaciones_creadas, "maintenance notifications")
        
        // Reload notifications only if new ones were created
        if (result && result.notificaciones_creadas > 0 && currentUser?.id) {
          console.log("[v0] Reloading notifications after maintenance check...")
          loadNotifications()
        }
      } catch (error) {
        console.error("[v0] Error checking upcoming maintenances:", error)
      }
    }

    // Only run if user is logged in
    if (currentUser?.id) {
      checkMaintenances()
      // Check every 5 minutes
      const interval = setInterval(checkMaintenances, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [currentUser?.id])

  // ADDED: Load equipment when entering mantenimiento section to populate select options
  useEffect(() => {
    if (activeSection === "mantenimiento" && equipment.length === 0) {
      loadEquipment()
    }
  }, [activeSection])

  // ADDED: Check equipment associations when equipment list is loaded or when entering equipos section
  useEffect(() => {
    const checkAllEquipmentAssociations = async () => {
      if (equipment && equipment.length > 0) {
        // Check associations for all equipment
        for (const equipo of equipment) {
          if (!equipmentAssociations[equipo.id]) {
            await checkEquipmentCanBeDeleted(equipo.id)
          }
        }
      }
    }

    if (activeSection === "equipos") {
      checkAllEquipmentAssociations()
    }
  }, [equipment, activeSection])

  // ADDED: Check equipment associations when opening equipment details dialog
  useEffect(() => {
    if (showEquipmentDetails && selectedEquipment && !equipmentAssociations[selectedEquipment.id]) {
      checkEquipmentCanBeDeleted(selectedEquipment.id)
    }
  }, [showEquipmentDetails, selectedEquipment])

  // CHANGE: Load equipment only when entering the 'equipos' section
  // This useEffect is now redundant due to the initial load and the activeSection specific load
  // Keeping it for now, but could be removed.
  // useEffect(() => {
  //   if (activeSection === "equipos") {
  //     loadEquipment()
  //   }
  // }, [activeSection])

  // CHANGE: Load dashboard stats once when authentication is checked
  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("[v0] Dashboard - fetching stats for user:", currentUser?.id)
        const data = await getDashboardStats()
        console.log("[v0] Dashboard - stats received:", data)
        setStats(data)
        setLoading(false)
      } catch (error) {
        console.error("[v0] Dashboard - error fetching stats:", error)
        setStats({
          usuariosCount: 0,
          equiposCount: 0,
          mantenimientosCount: 0,
          ordenesCount: 0,
          equiposPorFabricante: [],
          mantenimientosPorMes: [],
        })
        setLoading(false)
      }
    }

    // Load stats once authentication check is complete
    if (authChecked) {
      console.log("[v0] Dashboard - auth checked, fetching stats")
      fetchData()
    }
  }, [authChecked])

  // --- Maintenance Loaders and Stats ---
  const loadMaintenanceSchedules = async () => {
    setMaintenanceLoading(true)
    try {
      const params: { tipo?: string; frecuencia?: string } = {}
      
      if (maintenanceFilters.tipo !== "all") {
        params.tipo = maintenanceFilters.tipo
      }
      
      if (maintenanceFilters.frecuencia !== "all") {
        params.frecuencia = maintenanceFilters.frecuencia
      }
      
      const response = await getAllMantenimientos(params)
      setMaintenanceSchedules(response.data || [])

      await checkAndCreateWorkOrdersForMaintenance(response.data)
    } catch (error) {
      console.error("[v0] Error loading maintenance schedules:", error)
      // Fallback with mock data if needed
      setMaintenanceSchedules([
        {
          id: 1,
          equipoId: 1,
          equipo: "Monitor de Signos Vitales",
          tipo: "Preventivo",
          frecuencia: "Mensual",
          proximaFecha: "2024-08-15",
          ultimaFecha: "2024-07-15",
          observaciones: "Mantenimiento preventivo estándar realizado.",
        },
        {
          id: 2,
          equipoId: 2,
          equipo: "Bomba de Infusión",
          tipo: "Correctivo",
          frecuencia: "N/A",
          proximaFecha: "2024-08-20",
          ultimaFecha: "2024-08-10",
          observaciones: "Falla en el display, requiere revisión.",
        },
      ])
    } finally {
      setMaintenanceLoading(false)
    }
  }

  const loadMaintenanceStats = async () => {
    try {
      const stats = await getMantenimientosStats()
      setMaintenanceStats(stats)
    } catch (error) {
      console.error("[v0] Error loading maintenance stats:", error)
      setMaintenanceStats({
        vencidos: 0,
        proximos: 0,
        completados: 0,
        total: 0,
      })
    }
  }

  // Load maintenance schedules and stats when entering the maintenance section.
  useEffect(() => {
    if (activeSection === "mantenimiento") {
      loadMaintenanceSchedules()
      loadMaintenanceStats()
      loadEquipment() // Load equipment for dropdown
    }
  }, [activeSection])

  useEffect(() => {
    if (activeSection === "mantenimiento") {
      loadMaintenanceSchedules()
    }
  }, [maintenanceFilters.tipo, maintenanceFilters.frecuencia, activeSection])

  // CHANGE: Load work orders and users when entering the 'orders' section
  useEffect(() => {
    if (activeSection === "ordenes") {
      loadWorkOrders()
      loadUsers()
    }
  }, [activeSection, orderCurrentPage, orderPerPage, orderFilters, searchOrder, loadWorkOrders])

  // Reset pagination when filters or search term changes
  useEffect(() => {
    setOrderCurrentPage(1)
  }, [orderFilters, searchOrder])

  // Load users when entering the 'tecnicos' section.
  useEffect(() => {
    if (activeSection === "tecnicos") {
      loadUsers()
    }
  }, [activeSection, usersPaginaActual, usersPerPage, userFilters, userSearchTerm])

  const loadUsers = async () => {
    setUsersLoading(true)
    try {
      const params = {
        rol: userFilters.rol !== "all" ? userFilters.rol : undefined,
        estado: userFilters.estado !== "all" ? userFilters.estado : undefined,
        search: userSearchTerm || undefined,
        page: usersPaginaActual, // Added pagination params
        perPage: usersPerPage,
      }

      const response = await fetchUsuarios(params)
      setUsers(response.data)
      setUsersTotalPages(Math.ceil(response.total / usersPerPage))
    } catch (error) {
      console.error("[v0] Error loading users:", error)
      toast({
        title: "Error al cargar usuarios",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo conectar al backend.",
        variant: "destructive",
      })

      setUsers([])
      setUsersTotalPages(1)
    } finally {
      setUsersLoading(false)
    }
  }

  // ADDED: Function to check if an equipment can be deleted
  const checkEquipmentCanBeDeleted = async (equipmentId: number) => {
    try {
      console.log("[v0] Checking if equipment can be deleted:", equipmentId)
      const associations = await checkEquipoAssociations(equipmentId)
      console.log("[v0] Equipment associations:", associations)

      // Store the associations in state for later use
      setEquipmentAssociations((prev) => ({
        ...prev,
        [equipmentId]: associations,
      }))

      return !associations.hasMaintenances && !associations.hasWorkOrders
    } catch (error) {
      console.error("[v0] Error checking equipment associations:", error)
      // If API fails, allow deletion to proceed (fallback behavior)
      return true
    }
  }

  const handleSaveOrder = async () => {
    // Clear previous errors
    setOrderFormErrors({})

    // Validate required fields
    const errors: { [key: string]: string } = {}
    if (!newOrderData.equipoId || newOrderData.equipoId <= 0) {
      errors.equipoId = "El equipo es requerido"
    }
    if (!newOrderData.tipo?.trim()) {
      errors.tipo = "El tipo es requerido"
    }
    if (!newOrderData.prioridad?.trim()) {
      errors.prioridad = "La prioridad es requerida"
    }
    if (!newOrderData.descripcion?.trim()) {
      errors.descripcion = "La descripción es requerida"
    }

    // Validate dates
    if (newOrderData.fechaInicio && newOrderData.fechaFinalizacion) {
      const fechaInicio = new Date(newOrderData.fechaInicio)
      const fechaFinalizacion = new Date(newOrderData.fechaFinalizacion)
      
      if (fechaFinalizacion < fechaInicio) {
        errors.fechaFinalizacion = "La fecha de finalización debe ser posterior a la fecha de inicio"
      }
    }

    if (newOrderData.fechaInicio && !newOrderData.fechaFinalizacion) {
      errors.fechaFinalizacion = "La fecha de finalización es requerida si se establece una fecha de inicio"
    }

    if (newOrderData.fechaFinalizacion && !newOrderData.fechaInicio) {
      errors.fechaInicio = "La fecha de inicio es requerida si se establece una fecha de finalización"
    }

    if (Object.keys(errors).length > 0) {
      console.log("[v0] handleSaveOrder - Validation errors:", errors)
      setOrderFormErrors(errors)
      return
    }

    setIsLoadingOrders(true)

    try {
      // Create data object with camelCase field names for OrdenTrabajo interface
      const mappedData: Partial<OrdenTrabajo> = {
        id: selectedOrder?.id,
        equipoId: newOrderData.equipoId,
        tipo: newOrderData.tipo,
        prioridad: newOrderData.prioridad,
        descripcion: newOrderData.descripcion,
        estado: newOrderData.estado,
        tecnicoAsignadoId: newOrderData.tecnicoAsignadoId,
        fechaCreacion: newOrderData.fechaCreacion,
        fechaInicio: newOrderData.fechaInicio,
        fechaFinalizacion: newOrderData.fechaFinalizacion,
        horasTrabajadas: newOrderData.horasTrabajadas,
        costoRepuestos: newOrderData.costoRepuestos,
        costoTotal: newOrderData.costoTotal,
      }

  console.log("[v0] handleSaveOrder - Mapped data before save:", mappedData)
  const result = await saveOrdenTrabajo(mappedData)
  
  if (result.success && result.data) {
  toast({
  title: selectedOrder ? "Orden actualizada" : "Orden creada",
  description: selectedOrder
  ? "La orden de trabajo ha sido actualizada correctamente"
  : "La orden de trabajo ha sido creada correctamente",
  })
  setIsOrderDialogOpen(false)
  setNewOrderData({
  tipo: "Preventivo",
  prioridad: "media",
  estado: "abierta",
  fechaCreacion: new Date().toISOString().split("T")[0],
  })
  setSelectedOrder(null)
  // Clear all order-related cache entries to force refresh
  const params = {
    estado: orderFilters.estado !== "all" ? orderFilters.estado : undefined,
    prioridad: orderFilters.prioridad !== "all" ? orderFilters.prioridad : undefined,
    tipo: orderFilters.tipo !== "all" ? orderFilters.tipo : undefined,
    fechaDesde: orderFilters.fechaDesde || undefined,
    fechaHasta: orderFilters.fechaHasta || undefined,
    search: searchOrder || undefined,
    page: orderCurrentPage,
    perPage: orderPerPage,
  }
  const cacheKeyToClear = `ordenes_${JSON.stringify(params)}`
  console.log("[v0] handleSaveOrder - Clearing cache with key:", cacheKeyToClear)
  clearCache(cacheKeyToClear)
  console.log("[v0] handleSaveOrder - Cache cleared, calling loadWorkOrders")
  await loadWorkOrders()
  } else {
  throw new Error(result.error || "No se recibió respuesta del servidor")
  }
    } catch (error) {
      console.error("[v0] handleSaveOrder - Error:", error)
      const errorMessage = error instanceof Error ? error.message : "Error desconocido"
      setOrderFormErrors({
        general: `Error al guardar la orden: ${errorMessage}`,
      })
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar la orden de trabajo",
      })
    } finally {
      setIsLoadingOrders(false)
    }
  }

  const handleDeleteOrder = async (id: number) => {
    setSelectedOrderToDelete(id)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeleteOrder = async () => {
    if (!selectedOrderToDelete) return

    setIsLoadingOrders(true)

    try {
      const result = await removeOrdenTrabajo(selectedOrderToDelete)

      if (result.success) {
        toast({
          title: "Orden eliminada",
          description: "La orden de trabajo ha sido eliminada correctamente",
        })
        setIsDeleteDialogOpen(false)
        setSelectedOrderToDelete(null)
        // Clear cache before reloading to ensure fresh data
        clearCache()
        await loadWorkOrders()
      } else {
        toast({
          variant: "destructive",
          title: "Error al eliminar",
          description: result.error || "No se pudo eliminar la orden de trabajo",
        })
      }
    } catch (error) {
      console.error("[v0] confirmDeleteOrder - Unexpected error:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo eliminar la orden de trabajo",
      })
    } finally {
      setIsLoadingOrders(false)
    }
  }

  const handleAssignTechnician = async () => {
    if (selectedOrder && selectedTechnicianId) {
      const result = await asignarTecnicoAOrden(selectedOrder.id, selectedTechnicianId)
      if (result && result.success && result.data) {
        // Update the selected order with the new technician data
        setSelectedOrder(result.data)
        // Also refresh the work orders list
        await loadWorkOrders()
        // Show success feedback
        toast({
          title: "Técnico asignado",
          description: "El técnico ha sido asignado a la orden de trabajo",
        })
        setIsAssignDialogOpen(false)
        setSelectedTechnicianId(null)
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo asignar el técnico a la orden.",
        })
      }
    }
  }

  const handleChangeStatus = async () => {
    if (selectedOrder && newStatus) {
      const result = await cambiarEstadoOrden(selectedOrder.id, newStatus)
      if (result && result.success && result.data) {
        // Update the selected order with the new data
        setSelectedOrder(result.data)
        // Also refresh the work orders list
        await loadWorkOrders()
        // Show success feedback
        toast({
          title: "Estado actualizado",
          description: "La orden de trabajo ha sido actualizada correctamente",
        })
        setIsStatusDialogOpen(false)
        setNewStatus("")
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo cambiar el estado de la orden.",
        })
      }
    }
  }

  // CHANGE: Actualizando función para usar generateWorkOrderPDF con el diseño profesional
  const handleDownloadPDF = async (order: any) => {
    try {
      // Find equipment data for this order
      const orderEquipment = equipment.find((eq) => eq.id === order.equipoId)
      // Generate PDF for single order using the professional template with equipment data
      const doc = await generateWorkOrderPDF(order, orderEquipment)

      // Download PDF
      const filename = `Orden_Trabajo_${order.numeroOrden || order.id}_${new Date().toISOString().split("T")[0]}.pdf`
      downloadPDF(doc, filename)

      toast({
        title: "PDF generado",
        description: "La orden de trabajo ha sido descargada correctamente",
      })
    } catch (error) {
      console.error("[v0] handleDownloadPDF - Error:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo generar el PDF",
      })
    }
  }

  // CHANGE: Fixed recursive call - now calling getOrderStatusColor instead of getEstadoOrdenBadge
  const getEstadoOrdenBadge = (estado: string) => {
    const getOrderStatusColor = (estado: string) => {
      switch (estado) {
        case "abierta":
          return "bg-blue-100 text-blue-800"
        case "en_progreso": // CHANGE: Updated value to match snake_case expected by backend
          return "bg-yellow-100 text-yellow-800"
        case "completada":
          return "bg-green-100 text-green-800"
        case "pospuesta":
          return "bg-gray-100 text-gray-800"
        case "cancelada":
          return "bg-red-100 text-red-800"
        default:
          return "bg-gray-100 text-gray-800"
      }
    }

    return (
      <Badge className={`${getOrderStatusColor(estado)} rounded-md px-2 py-1`}>
        {estado.charAt(0).toUpperCase() + estado.slice(1)}
      </Badge>
    )
  }

  const getPriorityBadge = (prioridad: string) => {
    const getPriorityColor = (prioridad: string) => {
      switch (prioridad) {
        case "crítica":
          return "bg-red-100 text-red-800"
        case "alta":
          return "bg-orange-100 text-orange-800"
        case "media":
          return "bg-yellow-100 text-yellow-800"
        case "baja":
          return "bg-green-100 text-green-800"
        default:
          return "bg-gray-100 text-gray-800"
      }
    }

    return (
      <Badge className={`${getPriorityColor(prioridad)} rounded-md px-2 py-1`}>
        {prioridad.charAt(0).toUpperCase() + prioridad.slice(1)}
      </Badge>
    )
  }

  const filteredOrders = workOrders

  // Reset to page 1 if current page exceeds total pages
  useEffect(() => {
    if (orderCurrentPage > orderTotalPages) {
      setOrderCurrentPage(1)
    }
  }, [orderTotalPages, orderCurrentPage])

  const renderOrdenes = () => {
    // Data is already paginated from the server
    const paginatedOrders = filteredOrders
    const totalRecords = orderTotalRecords
    const startIndex = (orderCurrentPage - 1) * orderPerPage + 1
    const endIndex = startIndex + Math.min(filteredOrders.length, orderPerPage) - 1

    return (
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{""}</h1>
          <Button
            onClick={() => {
              setSelectedOrder(null)
              setNewOrderData({
                tipo: "Preventivo",
                prioridad: "media",
                estado: "abierta",
                fechaCreacion: new Date().toISOString().split("T")[0],
              })
              setIsOrderDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Orden
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Filtros:</span>
              </div>
              <Select
                value={orderFilters.estado}
                onValueChange={(value) => setOrderFilters({ ...orderFilters, estado: value })}
              >
                <SelectTrigger className="w-36 min-w-32">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="abierta">Abierta</SelectItem>
                  <SelectItem value="en_progreso">En Progreso</SelectItem>{" "}
                  {/* CHANGE: Updated value to match snake_case */}
                  <SelectItem value="completada">Completada</SelectItem>
                  <SelectItem value="pospuesta">Pospuesta</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={orderFilters.prioridad}
                onValueChange={(value) => setOrderFilters({ ...orderFilters, prioridad: value })}
              >
                <SelectTrigger className="w-36 min-w-32">
                  <SelectValue placeholder="Prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las prioridades</SelectItem>
                  <SelectItem value="crítica">Crítica</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={orderFilters.tipo}
                onValueChange={(value) => setOrderFilters({ ...orderFilters, tipo: value })}
              >
                <SelectTrigger className="w-36 min-w-32">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="Preventivo">Preventivo</SelectItem>
                  <SelectItem value="Correctivo">Correctivo</SelectItem>
                  <SelectItem value="Inspección">Inspección</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                className="w-40 bg-white"
                placeholder="Fecha desde"
                value={orderFilters.fechaDesde}
                onChange={(e) => setOrderFilters({ ...orderFilters, fechaDesde: e.target.value })}
              />
              <Input
                type="date"
                className="w-40 bg-white"
                placeholder="Fecha hasta"
                value={orderFilters.fechaHasta}
                onChange={(e) => setOrderFilters({ ...orderFilters, fechaHasta: e.target.value })}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOrderFilters({ estado: "all", prioridad: "all", tipo: "all", fechaDesde: "", fechaHasta: "" })
                  setSearchOrder("")
                  setOrderCurrentPage(1)
                }}
              >
                Limpiar
              </Button>
            </div>

            {/* Search and Controls */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">Mostrar</span>
                <Select value={orderPerPage.toString()} onValueChange={(value) => setOrderPerPage(Number(value))}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-600 dark:text-gray-400">registros</span>
              </div>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-500" />
                <Input
                  className="w-64"
                  placeholder="Buscar órdenes..."
                  value={searchOrder}
                  onChange={(e) => {
                    setSearchOrder(e.target.value)
                    setOrderCurrentPage(1)
                  }}
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      N° Orden
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Equipo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Prioridad
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Técnico
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoadingOrders ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        Cargando órdenes...
                      </td>
                    </tr>
                  ) : paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        No se encontraron órdenes de trabajo
                      </td>
                    </tr>
                ) : (
                  paginatedOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-600 font-mono">{order.numeroOrden}</td>
                      <td className="px-4 py-3">{order.equipoNombre}</td>
                        <td className="px-4 py-3">{order.tipo}</td>
                        <td className="px-4 py-3">{getPriorityBadge(order.prioridad)}</td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="p-0">
                                {getEstadoOrdenBadge(order.estado)}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem onClick={() => {
                                setSelectedOrder(order)
                                setNewStatus('abierta')
                                setIsStatusDialogOpen(true)
                              }}>Abierta</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedOrder(order)
                                setNewStatus('en_progreso')
                                setIsStatusDialogOpen(true)
                              }}>En Progreso</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedOrder(order)
                                setNewStatus('completada')
                                setIsStatusDialogOpen(true)
                              }}>Completada</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedOrder(order)
                                setNewStatus('pospuesta')
                                setIsStatusDialogOpen(true)
                              }}>Pospuesta</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedOrder(order)
                                setNewStatus('cancelada')
                                setIsStatusDialogOpen(true)
                              }}>Cancelada</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                        <td className="px-4 py-3">
                          {order.tecnicoAsignadoNombre || <span className="text-gray-400 text-sm">Sin asignar</span>}
                        </td>
                        <td className="px-4 py-3 text-sm">{formatDate(order.fechaCreacion)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* CHANGE: Added conditional rendering and colors to icons */}
                            {!order.tecnicoAsignadoId && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedOrder(order)
                                  setIsAssignDialogOpen(true)
                                }}
                              >
                                <UserPlus className="h-3 w-3 mr-1 text-green-600" />
                                Asignar
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedOrder(order)
                                setIsOrderDetailsOpen(true)
                              }}
                            >
                              <Eye className="h-4 w-4 text-blue-600" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedOrder(order)
                                    // Format dates for input fields using formatDateForInput utility
                                    setNewOrderData({
                                      ...order,
                                      fechaCreacion: formatDateForInput(order.fechaCreacion),
                                      fechaInicio: formatDateForInput(order.fechaInicio),
                                      fechaFinalizacion: formatDateForInput(order.fechaFinalizacion),
                                    })
                                    setIsOrderDialogOpen(true)
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-2 text-amber-600" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedOrder(order)
                                    setIsStatusDialogOpen(true)
                                  }}
                                >
                                  <Activity className="h-4 w-4 mr-2 text-purple-600" />
                                  Cambiar Estado
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadPDF(order)}>
                                  <Download className="h-4 w-4 mr-2 text-green-600" />
                                  Descargar PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteOrder(order.id)} className="text-red-600">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Mostrando {startIndex + 1} a {endIndex} de {totalRecords} registros
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={orderCurrentPage === 1}
                  onClick={() => {
                    if (orderCurrentPage > 1) {
                      setOrderCurrentPage(orderCurrentPage - 1)
                    }
                  }}
                >
                  Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(orderTotalPages, 5) }, (_, i) => {
                    let pageNum
                    if (orderTotalPages <= 5) {
                      pageNum = i + 1
                    } else if (orderCurrentPage <= 3) {
                      pageNum = i + 1
                    } else if (orderCurrentPage >= orderTotalPages - 2) {
                      pageNum = orderTotalPages - 4 + i
                    } else {
                      pageNum = orderCurrentPage - 2 + i
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === orderCurrentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setOrderCurrentPage(pageNum)}
                        className={pageNum === orderCurrentPage ? "bg-blue-600 text-white" : ""}
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={orderCurrentPage === orderTotalPages}
                  onClick={() => {
                    if (orderCurrentPage < orderTotalPages) {
                      setOrderCurrentPage(orderCurrentPage + 1)
                    }
                  }}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Create/Edit Order Dialog */}
        <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="order-form-desc">
            <DialogHeader>
              <DialogTitle>{selectedOrder ? "Editar Orden" : "Nueva Orden de Trabajo"}</DialogTitle>
              <DialogDescription id="order-form-desc">
                {selectedOrder ? "Modifica los datos de la orden" : "Completa los datos para crear una nueva orden"}
              </DialogDescription>
            </DialogHeader>

            {orderFormErrors.general && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{orderFormErrors.general}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="equipoId">Equipo *</Label>
                  <EquipmentCombobox
                    equipment={equipment}
                    value={newOrderData.equipoId?.toString() || ""}
                    onValueChange={(value) => {
                      setNewOrderData({ ...newOrderData, equipoId: Number(value) })
                      setOrderFormErrors({ ...orderFormErrors, equipoId: "" })
                    }}
                    error={!!orderFormErrors.equipoId}
                  />
                  {orderFormErrors.equipoId && <p className="text-red-500 text-xs">{orderFormErrors.equipoId}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select
                    value={newOrderData.tipo}
                    onValueChange={(value) => {
                      setNewOrderData({ ...newOrderData, tipo: value })
                      setOrderFormErrors({ ...orderFormErrors, tipo: "" }) // Clear error on change
                    }}
                  >
                    <SelectTrigger className={orderFormErrors.tipo ? "border-red-500" : ""}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Preventivo">Preventivo</SelectItem>
                      <SelectItem value="Correctivo">Correctivo</SelectItem>
                      <SelectItem value="Inspección">Inspección</SelectItem>
                    </SelectContent>
                  </Select>
                  {orderFormErrors.tipo && <p className="text-red-500 text-xs">{orderFormErrors.tipo}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prioridad">Prioridad *</Label>
                  <Select
                    value={newOrderData.prioridad}
                    onValueChange={(value) => {
                      setNewOrderData({ ...newOrderData, prioridad: value })
                      setOrderFormErrors({ ...orderFormErrors, prioridad: "" }) // Clear error on change
                    }}
                  >
                    <SelectTrigger className={orderFormErrors.prioridad ? "border-red-500" : ""}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="crítica">Crítica</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="media">Media</SelectItem>
                      <SelectItem value="baja">Baja</SelectItem>
                    </SelectContent>
                  </Select>
                  {orderFormErrors.prioridad && <p className="text-red-500 text-xs">{orderFormErrors.prioridad}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estado">Estado *</Label>
                  <Select
                    value={newOrderData.estado}
                    onValueChange={(value) => setNewOrderData({ ...newOrderData, estado: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="abierta">Abierta</SelectItem>
                      <SelectItem value="en_progreso">En Progreso</SelectItem>{" "}
                      {/* CHANGE: Updated value to match snake_case */}
                      <SelectItem value="completada">Completada</SelectItem>
                      <SelectItem value="pospuesta">Pospuesta</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tecnicoAsignadoId">Técnico Asignado</Label>
                  <Select
                    value={newOrderData.tecnicoAsignadoId?.toString() || "0"}
                    onValueChange={(value) => {
                      const numValue = Number(value)
                      setNewOrderData({
                        ...newOrderData,
                        tecnicoAsignadoId: numValue === 0 ? undefined : numValue,
                      })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Sin asignar</SelectItem>
                      {users
                        .filter((u) => {
                          const rolLower = u.rol?.toLowerCase() || ""
                          const rolMatch =
                            rolLower === "técnico" ||
                            rolLower === "tecnico" ||
                            rolLower === "supervisor" ||
                            rolLower === "administrador"
                          const estadoMatch = u.estado?.toLowerCase() === "activo"
                          return rolMatch && estadoMatch
                        })
                        .map((tech) => (
                          <SelectItem key={tech.id} value={tech.id.toString()}>
                            {tech.nombre} ({tech.rol})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción *</Label>
                <Textarea
                  id="descripcion"
                  placeholder="Describe el trabajo a realizar..."
                  value={newOrderData.descripcion || ""}
                  onChange={(e) => {
                    setNewOrderData({ ...newOrderData, descripcion: e.target.value })
                    setOrderFormErrors({ ...orderFormErrors, descripcion: "" }) // Clear error on change
                  }}
                  rows={3}
                  className={orderFormErrors.descripcion ? "border-red-500" : ""}
                />
                {orderFormErrors.descripcion && <p className="text-red-500 text-xs">{orderFormErrors.descripcion}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fechaCreacion">Fecha de Creación *</Label>
                  <Input
                    id="fechaCreacion"
                    type="date"
                    value={newOrderData.fechaCreacion || ""}
                    onChange={(e) => setNewOrderData({ ...newOrderData, fechaCreacion: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fechaInicio">Fecha de Inicio</Label>
                  <Input
                    id="fechaInicio"
                    type="date"
                    value={newOrderData.fechaInicio || ""}
                    onChange={(e) => setNewOrderData({ ...newOrderData, fechaInicio: e.target.value })}
                    className={orderFormErrors.fechaInicio ? "border-red-500" : ""}
                  />
                  {orderFormErrors.fechaInicio && (
                    <p className="text-red-500 text-xs">{orderFormErrors.fechaInicio}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fechaFinalizacion">Fecha de Finalización</Label>
                  <Input
                    id="fechaFinalizacion"
                    type="date"
                    value={newOrderData.fechaFinalizacion || ""}
                    onChange={(e) => setNewOrderData({ ...newOrderData, fechaFinalizacion: e.target.value })}
                    className={orderFormErrors.fechaFinalizacion ? "border-red-500" : ""}
                  />
                  {orderFormErrors.fechaFinalizacion && (
                    <p className="text-red-500 text-xs">{orderFormErrors.fechaFinalizacion}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="horasTrabajadas">Horas Trabajadas</Label>
                  <Input
                    id="horasTrabajadas"
                    type="number"
                    step="0.5"
                    value={newOrderData.horasTrabajadas || ""}
                    onChange={(e) => setNewOrderData({ ...newOrderData, horasTrabajadas: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="costoRepuestos">Costo Repuestos (Bs)</Label>
                  <Input
                    id="costoRepuestos"
                    type="number"
                    step="0.01"
                    value={newOrderData.costoRepuestos || ""}
                    onChange={(e) => setNewOrderData({ ...newOrderData, costoRepuestos: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="costoTotal">Costo Total (Bs)</Label>
                  <Input
                    id="costoTotal"
                    type="number"
                    step="0.01"
                    value={newOrderData.costoTotal || ""}
                    onChange={(e) => setNewOrderData({ ...newOrderData, costoTotal: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOrderDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveOrder} disabled={isLoadingOrders}>
                {selectedOrder ? "Guardar Cambios" : "Crear Orden"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Order Details Dialog */}
        <Dialog open={isOrderDetailsOpen} onOpenChange={setIsOrderDetailsOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" aria-describedby="order-details-desc">
            <DialogHeader>
              <DialogTitle>Detalles de la Orden</DialogTitle>
              <DialogDescription id="order-details-desc">{selectedOrder?.numeroOrden}</DialogDescription>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Equipo</Label>
                    <p className="text-base">{selectedOrder.equipoNombre}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Tipo</Label>
                    <p className="text-base">{selectedOrder.tipo}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Prioridad</Label>
                    <div className="mt-1">{getPriorityBadge(selectedOrder.prioridad)}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Estado</Label>
                    <div className="mt-1">{getEstadoOrdenBadge(selectedOrder.estado)}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Técnico Asignado</Label>
                    <p className="text-base">{selectedOrder.tecnicoAsignadoNombre || "Sin asignar"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Fecha de Creación</Label>
                    <p className="text-base">{formatDate(selectedOrder.fechaCreacion)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Fecha de Inicio</Label>
                    <p className="text-base">{formatDate(selectedOrder.fechaInicio) || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Fecha de Finalización</Label>
                    <p className="text-base">{formatDate(selectedOrder.fechaFinalizacion) || "-"}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Descripción</Label>
                  <p className="text-base mt-1">{selectedOrder.descripcion}</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Horas Trabajadas</Label>
                    <p className="text-base">{selectedOrder.horasTrabajadas || "0"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Costo Repuestos</Label>
                    <p className="text-base">Bs {Number(selectedOrder.costoRepuestos || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Costo Total</Label>
                    <p className="text-base font-semibold">Bs {Number(selectedOrder.costoTotal || 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOrderDetailsOpen(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Technician Dialog */}
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent className="sm:max-w-[500px]" aria-describedby="assign-tech-desc">
            <DialogHeader>
              <DialogTitle>Asignar Técnico</DialogTitle>
              <DialogDescription id="assign-tech-desc">Selecciona un técnico para la orden {selectedOrder?.numeroOrden}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Select onValueChange={(value) => setSelectedTechnicianId(Number(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar técnico" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((u) => {
                      const rolLower = u.rol?.toLowerCase() || ""
                      const rolMatch =
                        rolLower === "técnico" ||
                        rolLower === "tecnico" ||
                        rolLower === "supervisor" ||
                        rolLower === "administrador"
                      const estadoMatch = u.estado?.toLowerCase() === "activo"
                      return rolMatch && estadoMatch
                    })
                    .map((tech) => (
                      <SelectItem key={tech.id} value={tech.id.toString()}>
                        {tech.nombre} ({tech.rol})
                      </SelectItem>
                    ))}
                  {users.filter((u) => {
                    const rolLower = u.rol?.toLowerCase() || ""
                    const rolMatch =
                      rolLower === "técnico" ||
                      rolLower === "tecnico" ||
                      rolLower === "supervisor" ||
                      rolLower === "administrador"
                    const estadoMatch = u.estado?.toLowerCase() === "activo"
                    return rolMatch && estadoMatch
                  }).length === 0 && (
                    <SelectItem value="0" disabled>
                      No hay usuarios activos disponibles
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAssignDialogOpen(false)
                  setSelectedTechnicianId(null)
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleAssignTechnician} disabled={!selectedTechnicianId}>
                Asignar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Change Status Dialog */}
        <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
          <DialogContent aria-describedby="status-change-desc">
            <DialogHeader>
              <DialogTitle>Cambiar Estado</DialogTitle>
              <DialogDescription id="status-change-desc">Actualiza el estado de la orden {selectedOrder?.numeroOrden}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Select onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="abierta">Abierta</SelectItem>
                  <SelectItem value="en_progreso">En Progreso</SelectItem>
                  <SelectItem value="completada">Completada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                  <SelectItem value="pospuesta">Pospuesta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsStatusDialogOpen(false)
                  setNewStatus("")
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleChangeStatus} disabled={!newStatus}>
                Cambiar Estado
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Eliminación</DialogTitle>
              <DialogDescription>
                ¿Está seguro de que desea eliminar esta orden de trabajo? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false)
                  setSelectedOrderToDelete(null)
                }}
              >
                Cancelar
              </Button>
              <Button variant="destructive" onClick={confirmDeleteOrder} disabled={isLoadingOrders}>
                {isLoadingOrders ? "Eliminando..." : "Eliminar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* EQUIPMENT DELETE CONFIRMATION DIALOG */}
        <Dialog open={isDeleteEquipmentDialogOpen} onOpenChange={setIsDeleteEquipmentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Eliminación</DialogTitle>
              <DialogDescription>
                ¿Está seguro de que desea eliminar este equipo? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteEquipmentDialogOpen(false)
                  setSelectedEquipmentToDelete(null)
                }}
              >
                Cancelar
              </Button>
              <Button variant="destructive" onClick={confirmDeleteEquipment} disabled={equipmentLoading}>
                {equipmentLoading ? "Eliminando..." : "Eliminar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MAINTENANCE DELETE CONFIRMATION DIALOG */}
        <Dialog open={isDeleteMaintenanceDialogOpen} onOpenChange={setIsDeleteMaintenanceDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Eliminación</DialogTitle>
              <DialogDescription>
                ¿Está seguro de que desea eliminar este mantenimiento programado? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteMaintenanceDialogOpen(false)
                  setSelectedMaintenanceToDelete(null)
                }}
              >
                Cancelar
              </Button>
              <Button variant="destructive" onClick={confirmDeleteMaintenance} disabled={maintenanceLoading}>
                {maintenanceLoading ? "Eliminando..." : "Eliminar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  const getFilteredEquipment = useMemo(() => {
    // Equipment is already paginated and filtered from the server
    // Just return the items as-is
    return {
      items: equipment,
      total: totalEquipment,
    }
  }, [equipment, totalEquipment])

  const getStatusColor = (estado: string) => {
    if (!estado) {
      return "bg-gray-100 text-gray-800"
    }
    switch (estado.toLowerCase()) {
      case "operativo":
        return "bg-green-100 text-green-800"
      case "en reparacion":
      case "en_reparacion":
        return "bg-yellow-100 text-yellow-800"
      case "fuera de servicio":
      case "fuera de servicio":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusIcon = (estado: string) => {
    if (!estado) {
      return <LucideAlertCircle className="h-4 w-4" />
    }
    switch (estado.toLowerCase()) {
      case "operativo":
        return <CheckCircle2 className="h-4 w-4" />
      case "en reparacion":
      case "en_reparacion":
        return <Clock className="h-4 w-4" />
      case "fuera de servicio":
      case "fuera de servicio":
        return <XCircle className="h-4 w-4" />
      default:
        return <LucideAlertCircle className="h-4 w-4" />
    }
  }

  const resetEquipmentForm = () => {
    setEquipmentForm({
      estado: "operativo",
      ubicacion: "uci",
      // Reset other fields that might have values when editing
      numeroSerie: "",
      nombre: "",
      modelo: "",
      fabricante: "",
      fechaInstalacion: "",
      codigoInstitucional: "",
      servicio: "",
      vencimientoGarantia: "",
      fechaIngreso: "",
      procedencia: "",
      potencia: "",
      corriente: "",
      otrosEspecificaciones: "",
      accesoriosConsumibles: "",
      estadoEquipo: "operativo",
      manualUsuario: false,
      manualServicio: false,
      nivelRiesgo: "",
      proveedorNombre: "",
      proveedorDireccion: "",
      proveedorTelefono: "",
      observaciones: "", // Ensure observations are reset
    })
    setEditingEquipment(false) // Reset editing state
    setEquipmentFormErrors({}) // Clear errors
  }

  const handleSaveEquipment = async () => {
    // Validate form
    const errors: Record<string, string> = {}

    // Codigo Institucional validation
    if (!equipmentForm.codigoInstitucional || equipmentForm.codigoInstitucional.trim() === "") {
      errors.codigoInstitucional = "El código institucional es obligatorio"
    } else if (!/^\d{12}$/.test(equipmentForm.codigoInstitucional)) {
      errors.codigoInstitucional = "El código institucional debe tener exactamente 12 dígitos"
    }

    // Número de Serie - Mínimo 3 caracteres
    if (!equipmentForm.numeroSerie || equipmentForm.numeroSerie.trim() === "") {
      errors.numeroSerie = "El número de serie es requerido"
    } else if (equipmentForm.numeroSerie.trim().length < 3) {
      errors.numeroSerie = "El número de serie debe tener al menos 3 caracteres"
    }

    // Nombre del Equipo - Mínimo 3 caracteres
    if (!equipmentForm.nombre || equipmentForm.nombre.trim() === "") {
      errors.nombre = "El nombre del equipo es requerido"
    } else if (equipmentForm.nombre.trim().length < 3) {
      errors.nombre = "El nombre del equipo debe tener al menos 3 caracteres"
    }

    // Fabricante - Requerido
    if (!equipmentForm.fabricante || equipmentForm.fabricante.trim() === "") {
      errors.fabricante = "El fabricante es requerido"
    }

    // Modelo - Requerido
    if (!equipmentForm.modelo || equipmentForm.modelo.trim() === "") {
      errors.modelo = "El modelo es requerido"
    }

    // Ubicaci��n - Requerida
    if (!equipmentForm.ubicacion || equipmentForm.ubicacion.trim() === "") {
      errors.ubicacion = "La ubicación es requerida"
    }

    if (!equipmentForm.servicio || equipmentForm.servicio.trim() === "") {
      errors.servicio = "El servicio es obligatorio"
    } else if (equipmentForm.servicio.trim().length < 3) {
      errors.servicio = "El servicio debe tener al menos 3 caracteres"
    }

    if (!equipmentForm.nivelRiesgo || equipmentForm.nivelRiesgo.trim() === "") {
      errors.nivelRiesgo = "El nivel de riesgo es obligatorio"
    }

    // Validación de Fechas Lógicas
    if (equipmentForm.fechaRetiro && equipmentForm.fechaInstalacion) {
      const fechaRetiro = new Date(equipmentForm.fechaRetiro)
      const fechaInstalacion = new Date(equipmentForm.fechaInstalacion)
      if (fechaInstalacion > fechaRetiro) {
        errors.fechaInstalacion = "La fecha de instalación debe ser anterior a la fecha de adquisición"
      }
    }

    // Vencimiento de Garantía debe ser futuro
    if (equipmentForm.vencimientoGarantia) {
      const vencimiento = new Date(equipmentForm.vencimientoGarantia)
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      if (vencimiento < hoy) {
        errors.vencimientoGarantia = "El vencimiento de garantía debe ser una fecha futura"
      }
    }

    // Teléfono del Proveedor - Formato válido si se proporciona
    if (equipmentForm.proveedorTelefono && equipmentForm.proveedorTelefono.trim() !== "") {
      const phoneRegex = /^[\d\s\-+()]{7,20}$/
      if (!phoneRegex.test(equipmentForm.proveedorTelefono)) {
        errors.proveedorTelefono = "Formato de teléfono inválido"
      }
    }

    // Frecuencia - Validación
    const isDC = equipmentForm.voltaje?.toUpperCase().includes("DC")

    if (!isDC && equipmentForm.frecuencia && equipmentForm.frecuencia.trim() !== "") {
      const frecuenciaValue = equipmentForm.frecuencia.trim()

      // Valid formats: 50 Hz, 60 Hz, 50-60 Hz, 50–60 Hz (with en-dash)
      const validFormatRegex = /^(50|60|50[-–]\s*60)\s*(Hz|hz)?$/i

      if (!validFormatRegex.test(frecuenciaValue)) {
        errors.frecuencia = "Formato válido: 50 Hz, 60 Hz o 50-60 Hz"
      } else {
        // Extract numeric values to validate range (49-61 Hz)
        const numericMatch = frecuenciaValue.match(/\d+/g)
        if (numericMatch) {
          const values = numericMatch.map(Number)
          const outOfRange = values.some((val) => val < 49 || val > 61)

          if (outOfRange) {
            errors.frecuencia = "La frecuencia debe estar entre 49-61 Hz"
          }
        }
      }
    }

    // Estado del Equipo - Requerido
    if (!equipmentForm.estadoEquipo) {
      errors.estadoEquipo = "Debe seleccionar un estado del equipo"
    }

    // Estado - Requerido
    if (!equipmentForm.estado) {
      errors.estado = "Debe seleccionar un estado"
    }

    // Si hay errores, mostrarlos y hacer scroll al primer campo con error
    if (Object.keys(errors).length > 0) {
      setEquipmentFormErrors(errors)

      // Auto-scroll al primer campo con error
      const firstErrorField = Object.keys(errors)[0]
      setTimeout(() => {
        const element = document.getElementById(firstErrorField)
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" })
          element.focus()
        }
      }, 100)

      toast({
        variant: "destructive",
        title: "Error de validación",
        description: "Por favor corrija los errores en el formulario antes de guardar",
      })
      return
    }

    setEquipmentFormErrors({})
    setEquipmentLoading(true)
    try {
      const equipoData = transformEquipmentToEquipo({
        ...equipmentForm,
        id: equipmentForm.id || 0,
      }) as Equipo

      const result = await saveEquipo(equipoData)

      if (result.success && result.equipo) {
        toast({
          title: editingEquipment ? "Equipo actualizado" : "Equipo guardado",
          description: `El equipo ha sido ${editingEquipment ? "actualizado" : "guardado"} exitosamente.`,
        })
        setShowEquipmentForm(false)
        resetEquipmentForm()
        
        // Clear equipment cache to force refresh
        const { clearCache } = await import("@/lib/utils/module-loader")
        clearCache() // Clear all cache to ensure fresh data
        
        await loadEquipment()
      } else {
        const backendErrors: Record<string, string> = {}

        // Parse backend validation errors
        if (result.error) {
          try {
            // Try to parse JSON error response
            const errorMatch = result.error.match(/\{.*\}/)
            if (errorMatch) {
              const errorData = JSON.parse(errorMatch[0])

              // Map backend field names to frontend field names
              const fieldMapping: Record<string, string> = {
                codigo_institucional: "codigoInstitucional",
                fecha_ingreso: "fechaIngreso",
                fecha_adquisicion: "fechaAdquisicion",
                fecha_instalacion: "fechaInstalacion",
                fecha_vencimiento_garantia: "fechaVencimientoGarantia",
                numero_serie: "numeroSerie",
                estado_equipo: "estadoEquipo",
                nivel_riesgo: "nivelRiesgo",
              }

              if (errorData.errors) {
                // Process each error field
                Object.entries(errorData.errors).forEach(([backendField, messages]) => {
                  const frontendField = fieldMapping[backendField] || backendField
                  const errorMessages = Array.isArray(messages) ? messages : [messages]
                  backendErrors[frontendField] = errorMessages[0]
                })
              }
            }
          } catch (e) {
            // If parsing fails, handle specific known errors
            if (result.error.includes("codigo_institucional")) {
              backendErrors.codigoInstitucional = "Este código institucional ya está registrado"
            } else if (result.error.includes("fecha_ingreso")) {
              backendErrors.fechaIngreso = "La fecha de ingreso no puede ser futura"
            } else {
              backendErrors.general = result.error
            }
          }
        }

        setEquipmentFormErrors(backendErrors)

        // Scroll to first error field
        const firstErrorField = Object.keys(backendErrors)[0]
        if (firstErrorField && firstErrorField !== "general") {
          setTimeout(() => {
            const element = document.getElementById(firstErrorField)
            if (element) {
              element.scrollIntoView({ behavior: "smooth", block: "center" })
              element.focus()
            }
          }, 100)
        }

        toast({
          variant: "destructive",
          title: "Error al guardar equipo",
          description:
            backendErrors[Object.keys(backendErrors)[0]] || "No se pudo guardar el equipo. Por favor intente de nuevo.",
        })
      }
    } catch (error) {
      console.error("[v0] Error saving equipment:", error)
      setEquipmentFormErrors({ general: "Error de conexión al guardar el equipo" })
      toast({
        variant: "destructive",
        title: "Error de conexión",
        description: "No se pudo conectar con el servidor. Verifique su conexión e intente nuevamente.",
      })
    } finally {
      setEquipmentLoading(false)
    }
  }

  const handleDeleteEquipment = async (id: number) => {
    // CHANGE: Remove browser confirm and use Dialog instead
    setSelectedEquipmentToDelete(id)
    setIsDeleteEquipmentDialogOpen(true)
  }

  // CHANGE: New function to confirm equipment deletion
  const confirmDeleteEquipment = async () => {
    if (!selectedEquipmentToDelete) return

    setEquipmentLoading(true)
    try {
      const userId = localStorage.getItem("userId")
      const result = await removeEquipo(selectedEquipmentToDelete, userId || undefined)

      if (result.success) {
        toast({
          title: "Equipo eliminado",
          description: "El equipo ha sido eliminado exitosamente",
        })
        setIsDeleteEquipmentDialogOpen(false)
        setSelectedEquipmentToDelete(null)
        setShowEquipmentDetails(false) // Close details if open
        
        // Clear equipment cache to force refresh
        const { clearCache } = await import("@/lib/utils/module-loader")
        clearCache() // Clear all cache to ensure fresh data
        
        await loadEquipment()
      } else {
        toast({
          variant: "destructive",
          title: "Error al eliminar",
          description: result.error || "No se pudo eliminar el equipo",
        })
      }
    } catch (error) {
      console.error("[v0] Error deleting equipment:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al eliminar el equipo",
      })
    } finally {
      setEquipmentLoading(false)
    }
  }

  const handleViewEquipmentDetails = async (equipo: Equipment) => {
    setSelectedEquipment(equipo)
    setShowEquipmentDetails(true)

    try {
      const details = await getEquipo(equipo.id)
      if (details) {
        const transformedDetails = transformEquipoToEquipment(details)

        // Handle documents if they exist
        if ((details as any).documentos && Array.isArray((details as any).documentos)) {
          transformedDetails.documentos = (details as any).documentos.map((d: any) => ({
            id: d.id, // Add id from API response
            nombre: d.nombre || "Sin nombre",
            tipo: d.tipo || "desconocido",
            fechaSubida: d.fecha_subida || d.fechaSubida || "N/A",
            url: d.url, // Add url from API response
          }))
        }
        setSelectedEquipment(transformedDetails)
      } else {
        // Keep the basic equipment data that was already set
      }
    } catch (error) {
      console.error("[v0] Error loading equipment details:", error)
      // Keep the basic equipment data that was already set
    }
  }

  // CHANGE: Simplified handleFileUpload - remove complex dependencies
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedEquipment?.id) {
      console.error("[v0] handleFileUpload - File or equipment missing")
      return
    }

    try {
      setEquipmentLoading(true)
      const userId = localStorage.getItem("userId") || "1"
      const authToken = localStorage.getItem("authToken")
      
      const formData = new FormData()
      formData.append("archivo", file)
      formData.append("subido_por_id", userId)
      
      const headers: Record<string, string> = {
        "X-User-ID": userId,
      }
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`
      }
      
      console.error("[v0] handleFileUpload - Starting upload:", {
        fileName: file.name,
        fileSize: file.size,
        equipmentId: selectedEquipment.id,
        userId: userId,
        hasAuthToken: !!authToken,
        authTokenLength: authToken?.length || 0,
        headers: Object.keys(headers),
      })
      
      const response = await fetch(`/api/equipos/${selectedEquipment.id}/documentos`, {
        method: "POST",
        credentials: "include",
        headers,
        body: formData,
      })
      
      console.error("[v0] handleFileUpload - Response status:", response.status)
      
      if (!response.ok) {
        const errorData = await response.text()
        console.error("[v0] handleFileUpload - Error response:", response.status, errorData)
        throw new Error(errorData || "Error uploading file")
      }
      
      const result = await response.json()
      console.error("[v0] handleFileUpload - Upload successful, result:", result)
      
      toast({ title: "Éxito", description: `${file.name} subido correctamente` })
      
      // Refresh equipment details to show new document
      // Use handleViewEquipmentDetails to reload with proper transformation
      if (selectedEquipment?.id) {
        console.error("[v0] handleFileUpload - Reloading equipment details...")
        await handleViewEquipmentDetails(selectedEquipment)
      }
    } catch (error) {
      console.error("[v0] handleFileUpload - Upload error:", error)
      toast({ variant: "destructive", title: "Error", description: "Error al subir documento" })
    } finally {
      setEquipmentLoading(false)
      if (e.target) e.target.value = ""
    }
  }

  const handleViewDocument = (doc: { id?: number; url?: string }) => {
    if (doc.url) {
      const fullUrl = getDocumentoUrl(doc.url)
      window.open(fullUrl, "_blank")
    }
  }

  const handleDownloadDocument = async (doc: { id?: number; nombre?: string }) => {
    if (!doc.id) return

    try {
      const { downloadDocumento } = await import("@/lib/api/documentos")
      const blob = await downloadDocumento(doc.id)

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = doc.nombre || "documento"
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Error downloading document:", error)
      toast({
        variant: "destructive",
        title: "Error al descargar documento",
        description: "Ocurrió un error al descargar el archivo.",
      })
    }
  }

  const handleDeleteDocument = async (docId: number, index: number) => {
    if (!selectedEquipment) return

    if (!confirm("¿Está seguro de eliminar este documento?")) return

    try {
      setEquipmentLoading(true)
      console.log('[v0] handleDeleteDocumento - Starting delete for docId:', docId)

      const { deleteDocumento } = await import("@/lib/api/documentos")
      await deleteDocumento(docId)
      console.log('[v0] handleDeleteDocumento - Document deleted successfully')

      // Refresh equipment details
      console.log('[v0] handleDeleteDocumento - Fetching updated equipment:', selectedEquipment.id)
      const updatedEquipment = await getEquipo(selectedEquipment.id)
      console.log('[v0] handleDeleteDocumento - Updated equipment received:', updatedEquipment)
      
      const transformedEquipment = transformEquipoToEquipment(updatedEquipment)
      console.log('[v0] handleDeleteDocumento - Transformed equipment:', transformedEquipment)

      console.log('[v0] handleDeleteDocumento - Setting selected equipment and updating list')
      setSelectedEquipment(transformedEquipment)
      setEquipment(equipment.map((eq) => (eq.id === selectedEquipment.id ? transformedEquipment : eq)))

      console.log('[v0] handleDeleteDocumento - Delete completed successfully')
      toast({
        title: "Documento eliminado",
        description: "El documento se ha eliminado exitosamente.",
      })
    } catch (error) {
      console.error("Error deleting document:", error)
      console.error('[v0] handleDeleteDocumento - Error details:', error)
      toast({
        variant: "destructive",
        title: "Error al eliminar documento",
        description: "Ocurrió un error al eliminar el archivo.",
      })
    } finally {
      setEquipmentLoading(false)
    }
  }

  // Removed handleNotifyEquipment
  // const handleNotifyEquipment = (equipo: Equipment) => {
  //   alert(`Notificación enviada para el equipo: ${equipo.nombre}`)
  // }

  const renderDashboard = () => {
    if (loading) {
      return (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Técnicos</p>
                  <p className="text-3xl font-bold">{stats ? stats.usuariosCount : <Skeleton className="h-10 w-16" />}</p>
                </div>
                <Users className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-amber-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Equipos</p>
                  <p className="text-3xl font-bold">{stats ? stats.equiposCount : <Skeleton className="h-10 w-16" />}</p>
                </div>
                <Wrench className="h-8 w-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-sky-500 to-blue-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sky-100 text-sm">Mantenimientos</p>
                  <p className="text-3xl font-bold">{stats ? stats.mantenimientosCount : <Skeleton className="h-10 w-16" />}</p>
                </div>
                <SettingsIcon className="h-8 w-8 text-sky-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Fabricantes Actuales</h3>
            <div className="flex flex-wrap gap-2">
              {configManufacturers.length > 0 ? (
                configManufacturers.map((manufacturer, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium"
                  >
                    <Briefcase className="h-4 w-4" />
                    {manufacturer}
                  </div>
                ))
              ) : (
                <p className="text-gray-400">No hay fabricantes configurados</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Equipos por Fabricante</h3>
              {stats?.equiposPorFabricante && stats.equiposPorFabricante.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.equiposPorFabricante}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nombre" />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="cantidad" fill="#f97316" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded">
                  <AlertCircle className="h-12 w-12 mb-3 text-gray-300" />
                  <p>No hay datos de equipos registrados</p>
                  <p className="text-xs mt-1">Registra equipos en la sección de Gestión de Equipos</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Mantenimientos por Mes</h3>
              {stats?.mantenimientosPorMes && stats.mantenimientosPorMes.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={stats.mantenimientosPorMes}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="cantidad" stroke="#3b82f6" name="Cantidad" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded">
                  <AlertCircle className="h-12 w-12 mb-3 text-gray-300" />
                  <p>No hay datos de mantenimientos</p>
                  <p className="text-xs mt-1">Los mantenimientos aparecerán cuando se registren</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const renderGestionEquipos = () => (
    <TooltipProvider>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800"></h1>
        <Dialog open={showEquipmentForm} onOpenChange={setShowEquipmentForm}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Equipo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingEquipment ? "Editar Equipo" : "Registrar Nuevo Equipo"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <h3 className="text-lg font-semibold mb-3 text-blue-700">Información Básica</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="numeroSerie">Número de Serie *</Label>
                <Input
                  id="numeroSerie"
                  placeholder="Ej: BM2024001"
                  value={equipmentForm.numeroSerie || ""}
                  onChange={(e) => {
                    setEquipmentForm({ ...equipmentForm, numeroSerie: e.target.value })
                    setEquipmentFormErrors({ ...equipmentFormErrors, numeroSerie: "" })
                  }}
                />
                {equipmentFormErrors.numeroSerie && (
                  <p className="text-red-500 text-xs">{equipmentFormErrors.numeroSerie}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="codigoInstitucional">Código Institucional</Label>
                <Input
                  id="codigoInstitucional"
                  placeholder="Ej: TX-001"
                  value={equipmentForm.codigoInstitucional || ""}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 12)
                    setEquipmentForm({ ...equipmentForm, codigoInstitucional: value })
                  }}
                  maxLength={12}
                  inputMode="numeric"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del Equipo *</Label>
                <Input
                  id="nombre"
                  placeholder="Ej: Monitor de Signos Vitales"
                  value={equipmentForm.nombre || ""}
                  onChange={(e) => {
                    setEquipmentForm({ ...equipmentForm, nombre: e.target.value })
                    setEquipmentFormErrors({ ...equipmentFormErrors, nombre: "" })
                  }}
                />
                {equipmentFormErrors.nombre && <p className="text-red-500 text-xs">{equipmentFormErrors.nombre}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="servicio">Servicio</Label>
                <Input
                  id="servicio"
                  placeholder="Ej: Laboratorio"
                  value={equipmentForm.servicio || ""}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, servicio: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fabricante">Marca / Fabricante</Label>
                <Select
                  value={equipmentForm.fabricante}
                  onValueChange={(value) => {
                    setEquipmentForm({ ...equipmentForm, fabricante: value })
                    setEquipmentFormErrors({ ...equipmentFormErrors, fabricante: "" })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar fabricante" />
                  </SelectTrigger>
                  <SelectContent>
                    {configManufacturers.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {equipmentFormErrors.fabricante && (
                  <p className="text-red-500 text-xs">{equipmentFormErrors.fabricante}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="modelo">Modelo</Label>
                <Input
                  id="modelo"
                  placeholder="Ej: VSM-3000"
                  value={equipmentForm.modelo || ""}
                  onChange={(e) => {
                    setEquipmentForm({ ...equipmentForm, modelo: e.target.value })
                    setEquipmentFormErrors({ ...equipmentFormErrors, modelo: "" })
                  }}
                />
                {equipmentFormErrors.modelo && <p className="text-red-500 text-xs">{equipmentFormErrors.modelo}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fechaIngreso">Fecha de Ingreso</Label>
                <Input
                  id="fechaIngreso"
                  type="date"
                  value={equipmentForm.fechaIngreso || ""}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, fechaIngreso: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vencimientoGarantia">Vencimiento Garantía</Label>
                <Input
                  id="vencimientoGarantia"
                  type="date"
                  value={equipmentForm.vencimientoGarantia || ""}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, vencimientoGarantia: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="procedencia">Procedencia</Label>
                <Select
                  value={equipmentForm.procedencia}
                  onValueChange={(value) => setEquipmentForm({ ...equipmentForm, procedencia: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nacional">Nacional</SelectItem>
                    <SelectItem value="importado">Importado</SelectItem>
                    <SelectItem value="donacion">Donación</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ubicacion">Ubicación</Label>
                <Select
                  value={equipmentForm.ubicacion}
                  onValueChange={(value) => {
                    setEquipmentForm({ ...equipmentForm, ubicacion: value })
                    setEquipmentFormErrors({ ...equipmentFormErrors, ubicacion: "" })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar ubicación" />
                  </SelectTrigger>
                  <SelectContent>
                    {configLocations.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {equipmentFormErrors.ubicacion && (
                  <p className="text-red-500 text-xs">{equipmentFormErrors.ubicacion}</p>
                )}
              </div>

              <div className="col-span-2 mt-4">
                <h3 className="text-lg font-semibold mb-3 text-blue-700">Especificaciones Técnicas</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="voltaje">Voltaje</Label>
                <Input
                  id="voltaje"
                  placeholder="Ej: 220V AC"
                  value={equipmentForm.voltaje || ""}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, voltaje: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="potencia">Potencia</Label>
                <Input
                  id="potencia"
                  placeholder="Ej: 500W"
                  value={equipmentForm.potencia || ""}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, potencia: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="corriente">Corriente</Label>
                <Input
                  id="corriente"
                  placeholder="Ej: 2.5A"
                  value={equipmentForm.corriente || ""}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, corriente: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="frecuencia">Frecuencia</Label>
                <Input
                  id="frecuencia"
                  placeholder="Ej: 50-60Hz"
                  value={equipmentForm.frecuencia || ""}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, frecuencia: e.target.value })}
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="otrosEspecificaciones">Otras Especificaciones</Label>
                <Textarea
                  id="otrosEspecificaciones"
                  placeholder="Especificaciones técnicas adicionales"
                  value={equipmentForm.otrosEspecificaciones || ""}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, otrosEspecificaciones: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="col-span-2 mt-4">
                <h3 className="text-lg font-semibold mb-3 text-blue-700">Accesorios y Estado</h3>
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="accesoriosConsumibles">Accesorios / Consumibles</Label>
                <Textarea
                  id="accesoriosConsumibles"
                  placeholder="Lista de accesorios y consumibles del equipo"
                  value={equipmentForm.accesoriosConsumibles || ""}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, accesoriosConsumibles: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estadoEquipo">Estado del Equipo</Label>
                <Select
                  value={equipmentForm.estadoEquipo}
                  onValueChange={(value) => setEquipmentForm({ ...equipmentForm, estadoEquipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nuevo">Nuevo</SelectItem>
                    <SelectItem value="operado">Operativo</SelectItem>
                    <SelectItem value="no_operable">No Operable</SelectItem>
                  </SelectContent>
                </Select>
                {equipmentFormErrors.estadoEquipo && (
                  <p className="text-red-500 text-xs">{equipmentFormErrors.estadoEquipo}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="nivelRiesgo">Nivel de Riesgo</Label>
                <Select
                  value={equipmentForm.nivelRiesgo}
                  onValueChange={(value) => setEquipmentForm({ ...equipmentForm, nivelRiesgo: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar nivel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alto">Alto</SelectItem>
                    <SelectItem value="medio">Medio</SelectItem>
                    <SelectItem value="bajo">Bajo</SelectItem>
                  </SelectContent>
                </Select>
                {equipmentFormErrors.nivelRiesgo && (
                  <p className="text-red-500 text-xs">{equipmentFormErrors.nivelRiesgo}</p>
                )}
              </div>

              {/* CHANGE: Updated manual checkboxes */}
              <div className="space-y-2">
                <Label>Manuales</Label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="manualUsuario"
                      checked={equipmentForm.manualUsuario || false}
                      onChange={(e) => setEquipmentForm({ ...equipmentForm, manualUsuario: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="manualUsuario" className="font-normal cursor-pointer text-sm">
                      Manual de Usuario
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="manualServicio"
                      checked={equipmentForm.manualServicio || false}
                      onChange={(e) => setEquipmentForm({ ...equipmentForm, manualServicio: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="manualServicio" className="font-normal cursor-pointer text-sm">
                      Manual de Servicio
                    </Label>
                  </div>
                </div>
              </div>

              <div className="col-span-2 mt-4">
                <h3 className="text-lg font-semibold mb-3 text-blue-700">Datos del Proveedor</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proveedorNombre">Nombre del Proveedor</Label>
                <Input
                  id="proveedorNombre"
                  placeholder="Nombre de la empresa"
                  value={equipmentForm.proveedorNombre || ""}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, proveedorNombre: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="proveedorTelefono">Teléfono / Celular</Label>
                <Input
                  id="proveedorTelefono"
                  placeholder="Ej: 591-4-1234567"
                  value={equipmentForm.proveedorTelefono || ""}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, proveedorTelefono: e.target.value })}
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="proveedorDireccion">Dirección</Label>
                <Input
                  id="proveedorDireccion"
                  placeholder="Dirección completa del proveedor"
                  value={equipmentForm.proveedorDireccion || ""}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, proveedorDireccion: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fechaInstalacion">Fecha de Instalación</Label>
                <Input
                  id="fechaInstalacion"
                  type="date"
                  value={equipmentForm.fechaInstalacion || ""}
                  onChange={(e) => {
                    setEquipmentForm({ ...equipmentForm, fechaInstalacion: e.target.value })
                    setEquipmentFormErrors({ ...equipmentFormErrors, fechaInstalacion: "" })
                  }}
                />
                {equipmentFormErrors.fechaInstalacion && (
                  <p className="text-red-500 text-xs">{equipmentFormErrors.fechaInstalacion}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="estado">Estado Operativo</Label>
                <Select
                  value={equipmentForm.estado}
                  onValueChange={(value) => {
                    setEquipmentForm({ ...equipmentForm, estado: value })
                    setEquipmentFormErrors({ ...equipmentFormErrors, estado: "" })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operativo">Operativo</SelectItem>
                    <SelectItem value="en reparacion">En Reparación</SelectItem>
                    <SelectItem value="fuera de servicio">Fuera de Servicio</SelectItem>
                  </SelectContent>
                </Select>
                {equipmentFormErrors.estado && <p className="text-red-500 text-xs">{equipmentFormErrors.estado}</p>}
              </div>

              {/* CHANGE: Added observaciones field to equipment form */}
              <div className="col-span-2 space-y-2">
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  placeholder="Notas adicionales sobre el equipo"
                  value={equipmentForm.observaciones || ""}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, observaciones: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            {equipmentFormErrors.general && <p className="text-red-500 text-xs">{equipmentFormErrors.general}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEquipmentForm(false)
                  resetEquipmentForm()
                }}
                disabled={equipmentLoading}
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveEquipment} disabled={equipmentLoading}>
                {equipmentLoading ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filtros:</span>
            </div>
            <Select
              value={equipmentFilters.estado}
              onValueChange={(value) => setEquipmentFilters({ ...equipmentFilters, estado: value })}
            >
              <SelectTrigger className="w-36 min-w-32">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="operativo">Operativo</SelectItem>
                <SelectItem value="en reparacion">En Reparación</SelectItem>
                <SelectItem value="fuera de servicio">Fuera de Servicio</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={equipmentFilters.ubicacion}
              onValueChange={(value) => setEquipmentFilters({ ...equipmentFilters, ubicacion: value })}
            >
              <SelectTrigger className="w-36 min-w-32">
                <SelectValue placeholder="Ubicación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las ubicaciones</SelectItem>
                {configLocations.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={equipmentFilters.fabricante}
              onValueChange={(value) => setEquipmentFilters({ ...equipmentFilters, fabricante: value })}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Fabricante" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los fabricantes</SelectItem>
                {configManufacturers.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEquipmentFilters({ estado: "all", ubicacion: "all", fabricante: "all" })}
            >
              Limpiar
            </Button>
          </div>

          {/* Search and Controls */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Mostrar</span>
              <select
                className="border border-gray-300 rounded px-2 py-1 text-sm"
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span className="text-sm text-gray-600">registros</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Buscar:</span>
              <Input
                className="w-48"
                placeholder=""
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>
          </div>

          {/* Table */}
          {equipmentLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
              <p className="text-gray-600">Cargando equipos...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">ID Equipo</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Serie</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Código Institucional</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Nombre</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Modelo</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Fabricante</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Ubicación</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Estado</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {getFilteredEquipment.items.map(
                    (
                      equipo, // Use .items from the memoized result
                    ) => (
                      <tr key={equipo.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-600 font-mono">{equipo.id}</td>
                        <td className="py-3 px-4 text-sm">{equipo.numeroSerie}</td>
                        <td className="py-3 px-4 text-sm">{equipo.codigoInstitucional || "-"}</td>
                        <td className="py-3 px-4 text-sm font-medium">{equipo.nombre}</td>
                        <td className="py-3 px-4 text-sm">{equipo.modelo}</td>
                        <td className="py-3 px-4 text-sm">{equipo.fabricante}</td>
                        <td className="py-3 px-4 text-sm">{equipo.ubicacion}</td>
                        <td className="py-3 px-4">
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge className={`${getStatusColor(equipo.estado)} flex items-center gap-1`}>
                                {getStatusIcon(equipo.estado)}
                                {equipo.estado}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Estado: {equipo.estado}</p>
                              <p>Instalado: {equipo.fechaInstalacion}</p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewEquipmentDetails(equipo)}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver detalles</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditEquipment(equipo)}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Modificar</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700 bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                                  onClick={() => handleDeleteEquipment(equipo.id)}
                                  disabled={
                                    equipmentAssociations[equipo.id]?.hasMaintenances ||
                                    equipmentAssociations[equipo.id]?.hasWorkOrders
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {equipmentAssociations[equipo.id]?.hasMaintenances ||
                                equipmentAssociations[equipo.id]?.hasWorkOrders
                                  ? "No se puede eliminar. Este equipo tiene mantenimientos u ��rdenes de trabajo asociadas."
                                  : "Eliminar"}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleGenerateEquipmentTechnicalSheet(equipo)}
                                  className="text-purple-600 hover:text-purple-700"
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ficha Técnica</TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <span className="text-sm text-gray-600">
              Mostrando {(currentPage - 1) * perPage + 1} a {Math.min(currentPage * perPage, totalEquipment)} de{" "}
              {totalEquipment} registros
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => {
                  if (currentPage > 1) {
                    setCurrentPage(currentPage - 1)
                  }
                }}
              >
                Anterior
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(Math.ceil(totalEquipment / perPage), 5) }, (_, i) => {
                  const totalPages = Math.ceil(totalEquipment / perPage)
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className={pageNum === currentPage ? "bg-blue-600 text-white" : ""}
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= Math.ceil(totalEquipment / perPage) || totalEquipment === 0}
                onClick={() => {
                  if (currentPage < Math.ceil(totalEquipment / perPage)) {
                    setCurrentPage(currentPage + 1)
                  }
                }}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Equipment Details Dialog */}
      <Dialog open={showEquipmentDetails} onOpenChange={setShowEquipmentDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles del Equipo - {selectedEquipment?.nombre || "Cargando..."}</DialogTitle>
          </DialogHeader>
          {selectedEquipment && (
            <div className="space-y-6">
              {/* Equipment Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <strong>ID Equipo:</strong> {selectedEquipment.id || "N/A"}
                </div>
                <div>
                  <strong>Número de Serie:</strong> {selectedEquipment.numeroSerie || "N/A"}
                </div>
                <div>
                  <strong>Código Institucional:</strong> {selectedEquipment.codigoInstitucional || "N/A"}
                </div>
                <div>
                  <strong>Nombre Equipo:</strong> {selectedEquipment.nombre || "N/A"}
                </div>
                <div>
                  <strong>Servicio:</strong> {selectedEquipment.servicio || "N/A"}
                </div>
                <div>
                  <strong>Fabricante:</strong> {selectedEquipment.fabricante || "N/A"}
                </div>
                <div>
                  <strong>Modelo:</strong> {selectedEquipment.modelo || "N/A"}
                </div>
                <div>
                  <strong>Fecha Ingreso:</strong>{" "}
                  {selectedEquipment.fechaIngreso ? formatDate(selectedEquipment.fechaIngreso) : "N/A"}
                </div>
                <div>
                  <strong>Vencimiento Garantía:</strong>{" "}
                  {selectedEquipment.vencimientoGarantia ? formatDate(selectedEquipment.vencimientoGarantia) : "N/A"}
                </div>
                <div>
                  <strong>Procedencia:</strong> {selectedEquipment.procedencia || "N/A"}
                </div>
                <div>
                  <strong>Ubicación:</strong> {selectedEquipment.ubicacion || "N/A"}
                </div>
                <div>
                  <strong>Fecha Instalación:</strong>{" "}
                  {selectedEquipment.fechaInstalacion ? formatDate(selectedEquipment.fechaInstalacion) : "N/A"}
                </div>
                <div>
                  <strong>Estado Operativo:</strong>
                  <Badge className={`ml-2 ${getStatusColor(selectedEquipment.estado)}`}>
                    {selectedEquipment.estado || "N/A"}
                  </Badge>
                </div>
                <div>
                  <strong>Voltaje:</strong> {selectedEquipment.voltaje || "N/A"}
                </div>
                <div>
                  <strong>Potencia:</strong> {selectedEquipment.potencia || "N/A"}
                </div>
                <div>
                  <strong>Corriente:</strong> {selectedEquipment.corriente || "N/A"}
                </div>
                <div>
                  <strong>Frecuencia:</strong> {selectedEquipment.frecuencia || "N/A"}
                </div>
                <div>
                  <strong>Otras Especificaciones:</strong> {selectedEquipment.otrosEspecificaciones || "N/A"}
                </div>
                <div>
                  <strong>Accesorios / Consumibles:</strong> {selectedEquipment.accesoriosConsumibles || "N/A"}
                </div>
                <div>
                  <strong>Estado del Equipo:</strong> {selectedEquipment.estadoEquipo || "N/A"}
                </div>
                <div>
                  <strong>Nivel de Riesgo:</strong> {selectedEquipment.nivelRiesgo || "N/A"}
                </div>
                <div className="col-span-2">
                  <strong>Nombre del Proveedor:</strong> {selectedEquipment.proveedorNombre || "N/A"}
                </div>
                <div className="col-span-2">
                  <strong>Dirección del Proveedor:</strong> {selectedEquipment.proveedorDireccion || "N/A"}
                </div>
                <div className="col-span-2">
                  <strong>Teléfono del Proveedor:</strong> {selectedEquipment.proveedorTelefono || "N/A"}
                </div>
                <div className="col-span-2">
                  <strong>Observaciones:</strong> {selectedEquipment.observaciones || "N/A"}
                </div>
                <div>
                  <strong>Manual de Usuario:</strong> {selectedEquipment.manualUsuario ? "Sí" : "No"}
                </div>
                <div>
                  <strong>Manual de Servicio:</strong> {selectedEquipment.manualServicio ? "Sí" : "No"}
                </div>
              </div>

              {/* Task History - REMOVED */}
              {/* Historial de Tareas section has been removed */}

              {/* Documents */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium">Documentos Asociados</h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="document-upload"
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                      onChange={handleFileUpload}
                      disabled={equipmentLoading}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("document-upload")?.click()}
                      disabled={equipmentLoading}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {equipmentLoading ? "Subiendo..." : "Subir Documento"}
                    </Button>
                  </div>
                </div>
                
                {/* Documents List */}
                {selectedEquipment.documentos && selectedEquipment.documentos.length > 0 ? (
                  <div className="space-y-2">
                    {selectedEquipment.documentos.map((doc, index) => {
                      const isImage = doc.tipo?.startsWith("image/") || 
                                     doc.nombre?.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i)
                      return (
                        <div
                          key={doc.id || index}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                        >
                          <div className="flex items-center gap-3">
                            {isImage ? (
                              <ImageIcon className="h-5 w-5 text-green-600" />
                            ) : (
                              <FileText className="h-5 w-5 text-blue-600" />
                            )}
                            <div>
                              <p className="font-medium text-sm">{doc.nombre}</p>
                              <p className="text-xs text-gray-500">
                                {doc.fechaSubida ? formatDate(doc.fechaSubida) : "Sin fecha"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {doc.url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewDocument(doc)}
                                title="Ver documento"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {doc.id && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDownloadDocument(doc)}
                                  title="Descargar documento"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteDocument(doc.id!, index)}
                                  className="text-red-600 hover:text-red-700"
                                  title="Eliminar documento"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No hay documentos asociados</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Sube imagenes, PDFs o documentos usando el boton de arriba
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between pt-4 border-t">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleEditEquipment(selectedEquipment)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Modificar
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 hover:text-red-700 bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => handleDeleteEquipment(selectedEquipment.id)}
                    disabled={
                      equipmentLoading ||
                      equipmentAssociations[selectedEquipment?.id]?.hasMaintenances ||
                      equipmentAssociations[selectedEquipment?.id]?.hasWorkOrders
                    }
                    title={
                      equipmentAssociations[selectedEquipment?.id]?.hasMaintenances ||
                      equipmentAssociations[selectedEquipment?.id]?.hasWorkOrders
                        ? "No se puede eliminar. Este equipo tiene mantenimientos u órdenes de trabajo asociadas."
                        : undefined
                    }
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {equipmentLoading ? "Eliminando..." : "Eliminar"}
                  </Button>
                </div>
                <Button
                  onClick={() => handleGenerateEquipmentTechnicalSheet(selectedEquipment)}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Generar Ficha Técnica
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )

  const renderUsuarios = () => {
    // Apply filters first
    const filteredUsers = users.filter((user) => {
      const matchRol = userFilters.rol === "all" || user.rol === userFilters.rol
      const matchEstado = userFilters.estado === "all" || user.estado === userFilters.estado
      const matchSearch = !userSearchTerm || 
        user.nombre?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        user.rol?.toLowerCase().includes(userSearchTerm.toLowerCase())
      return matchRol && matchEstado && matchSearch
    })

    // Calculate pagination values
    const totalUsers = filteredUsers.length
    const totalPages = totalUsers === 0 ? 1 : Math.ceil(totalUsers / usersPerPage)
    const startIndex = (usersPaginaActual - 1) * usersPerPage
    const endIndex = Math.min(startIndex + usersPerPage, totalUsers)
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex)

    // The useEffect for users pagination is now at the top level.

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
  <h1 className="text-3xl font-bold">{""}</h1>
  <Button 
    onClick={() => {
      // Clean everything when opening for a new user
      setEditingUser(null)
      setNewUser({ estado: "Activo", contrasena: "" })
      setUserFormErrors({})
      setShowUserForm(true)
    }} 
    className="bg-green-600 hover:bg-green-700"
  >
  <Plus className="h-4 w-4 mr-2" />
  Nuevo Usuario
  </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filtros:</span>
              </div>
              <Select value={userFilters.rol} onValueChange={(value) => setUserFilters({ ...userFilters, rol: value })}>
                <SelectTrigger className="w-36 min-w-32">
                  <SelectValue placeholder="Todos los roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  <SelectItem value="Técnico">Técnico</SelectItem>
                  <SelectItem value="Supervisor">Supervisor</SelectItem>
                  <SelectItem value="Administrador">Administrador</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={userFilters.estado}
                onValueChange={(value) => setUserFilters({ ...userFilters, estado: value })}
              >
                <SelectTrigger className="w-36 min-w-32">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => { setUserFilters({ rol: "all", estado: "all" }); setUserSearchTerm(""); setUsersPaginaActual(1); }}>
                <X className="h-4 w-4 mr-2" />
                Limpiar
              </Button>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">Mostrar</span>
                <Select
                  value={usersPerPage.toString()}
                  onValueChange={(value) => {
                    setUsersPerPage(Number(value))
                    setUsersPaginaActual(1)
                  }}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-600">registros</span>
              </div>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Buscar:</span>
                <Input
                  className="w-56"
                  placeholder="Nombre, correo..."
                  value={userSearchTerm}
                  onChange={(e) => {
                    setUserSearchTerm(e.target.value)
                    setUsersPaginaActual(1)
                  }}
                />
              </div>
            </div>

            {/* Users Table */}
            {usersLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
                <p className="text-gray-600">Cargando usuarios...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left p-3 font-medium text-gray-700">ID Usuario</th>
                      <th className="text-left p-3 font-medium text-gray-700">Nombre</th>
                      <th className="text-left p-3 font-medium text-gray-700">Correo</th>
                      <th className="text-left p-3 font-medium text-gray-700">Rol</th>
                      <th className="text-left p-3 font-medium text-gray-700">Estado</th>
                      <th className="text-left p-3 font-medium text-gray-700">Fecha Creación</th>
                      <th className="text-left p-3 font-medium text-gray-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((user) => (
                      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 text-sm text-gray-600 font-mono">{user.id}</td>
                        <td className="p-3 text-sm font-medium">{user.nombre}</td>
                        <td className="p-3 text-sm text-gray-600">{user.email}</td>
                        <td className="p-3 text-sm">
                          <Badge
                            className={`rounded-md px-2 py-1 ${
                              user.rol === "Administrador"
                                ? "bg-blue-100 text-blue-800"
                                : user.rol === "Supervisor"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {user.rol}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm">
                          <Badge
                            className={`rounded-md px-2 py-1 ${
                              user.estado === "Activo" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}
                          >
                            {user.estado}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm text-gray-600">{formatDate(user.fecha_creacion)}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    const details = await fetchUsuarioDetails(user.id)
                                    setSelectedUser(details || user)
                                    setShowUserDetails(true)
                                    setUserActivity(null)
                                    setLoadingUserActivity(true)

                                    try {
                                      const token = localStorage.getItem("authToken")
                                      if (token) {
                                        const activity = await getUserActivity(user.id, token)
                                        setUserActivity(activity)
                                      }
                                    } catch (error) {
                                      console.error("[v0] Error loading user activity:", error)
                                    } finally {
                                      setLoadingUserActivity(false)
                                    }
                                  }}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver detalles</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
              onClick={() => {
                // Set editing user - useEffect will handle syncing to newUser
                setEditingUser(user)
                setShowUserForm(true)
              }}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      const newEstado = user.estado === "Activo" ? "Inactivo" : "Activo"
                                      const result = await toggleUserStatus(user.id, newEstado)

                                      if (result?.success) {
                                        toast({
                                          title: "Estado actualizado",
                                          description: `El usuario ${user.nombre} ha sido marcado como ${newEstado}`,
                                        })
                                        await loadUsers()
                                      } else {
                                        toast({
                                          title: "Error",
                                          description: result?.error || "No se pudo actualizar el estado del usuario",
                                          variant: "destructive",
                                        })
                                      }
                                    } catch (error) {
                                      console.error("[v0] Toggle exception", { error })
                                      toast({
                                        title: "Error",
                                        description: "Ocurrió un error al cambiar el estado",
                                        variant: "destructive",
                                      })
                                    }
                                  }}
                                  className={
                                    user.estado === "Activo"
                                      ? "text-orange-600 hover:text-orange-700"
                                      : "text-green-600 hover:text-green-700"
                                  }
                                >
                                  {user.estado === "Activo" ? (
                                    <UserX className="h-4 w-4" />
                                  ) : (
                                    <UserCheck className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{user.estado === "Activo" ? "Desactivar" : "Activar"}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    setSelectedUserToDelete(user.id)
                                    setIsDeleteUserDialogOpen(true)
                                  }}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Eliminar</TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between mt-6">
              <span className="text-sm text-gray-600">
                Mostrando {startIndex + 1} a {endIndex} de {totalUsers} registros
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={usersPaginaActual === 1}
                  onClick={() => {
                    if (usersPaginaActual > 1) {
                      setUsersPaginaActual(usersPaginaActual - 1)
                    }
                  }}
                >
                  Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(usersTotalPages, 5) }, (_, i) => {
                    let pageNum
                    if (usersTotalPages <= 5) {
                      pageNum = i + 1
                    } else if (usersPaginaActual <= 3) {
                      pageNum = i + 1
                    } else if (usersPaginaActual >= usersTotalPages - 2) {
                      pageNum = usersTotalPages - 4 + i
                    } else {
                      pageNum = usersPaginaActual - 2 + i
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === usersPaginaActual ? "default" : "outline"}
                        size="sm"
                        onClick={() => setUsersPaginaActual(pageNum)}
                        className={pageNum === usersPaginaActual ? "bg-blue-600 text-white" : ""}
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={usersPaginaActual === usersTotalPages}
                  onClick={() => {
                    if (usersPaginaActual < usersTotalPages) {
                      setUsersPaginaActual(usersPaginaActual + 1)
                    }
                  }}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Form Modal */}
        <Dialog 
          open={showUserForm} 
          onOpenChange={(open) => {
            setShowUserForm(open)
            if (!open) {
              // Clean up state when dialog closes
              setTimeout(() => {
                setEditingUser(null)
                setNewUser({ estado: "Activo" })
                setUserFormErrors({})
              }, 0)
            } else if (open && !editingUser) {
              // When opening for a new user, clear any previous state
              setNewUser({ estado: "Activo" })
              setUserFormErrors({})
            }
            // When editing, useEffect will handle syncing the form
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingUser ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={newUser.nombre || ""}
                  onChange={(e) => {
                    setNewUser({ ...newUser, nombre: e.target.value })
                    setUserFormErrors({ ...userFormErrors, nombre: "" })
                  }}
                  placeholder="Nombre completo"
                  required
                />
                {userFormErrors.nombre && <p className="text-red-500 text-xs">{userFormErrors.nombre}</p>}
              </div>
              <div>
                <Label htmlFor="correo">Correo *</Label>
                <Input
                  id="correo"
                  type="email"
                  value={newUser.email || ""}
                  onChange={(e) => {
                    setNewUser({ ...newUser, email: e.target.value })
                    setUserFormErrors({ ...userFormErrors, email: "" })
                  }}
                  placeholder="correo@hospital.com"
                  required
                />
                {userFormErrors.email && <p className="text-red-500 text-xs">{userFormErrors.email}</p>}
              </div>
              {!editingUser && (
                <div className="md:col-span-2">
                  <Label htmlFor="contrasena">Contraseña *</Label>
                  <Input
                    id="contrasena"
                    type="password"
                    value={newUser.contrasena || ""}
                    onChange={(e) => {
                      setNewUser({ ...newUser, contrasena: e.target.value })
                      setUserFormErrors({ ...userFormErrors, contrasena: "" })
                    }}
                    placeholder="Mínimo 6 caracteres"
                    required
                  />
                  {userFormErrors.contrasena && <p className="text-red-500 text-xs">{userFormErrors.contrasena}</p>}
                </div>
              )}
              <div>
                <Label htmlFor="rol">Rol *</Label>
                <Select
                  value={newUser.rol || ""}
                  onValueChange={(value) => {
                    const rol = value as Usuario["rol"]
                    setNewUser({ ...newUser, rol })
                    setUserFormErrors({ ...userFormErrors, rol: "" })

                    // Map rol values to permission keys
                    const roleMap: Record<string, "administrador" | "supervisor" | "tecnico"> = {
                      Administrador: "administrador",
                      Supervisor: "supervisor",
                      Técnico: "tecnico",
                    }

                    const roleKey = roleMap[rol]
                    if (roleKey && DEFAULT_PERMISSIONS_BY_ROLE[roleKey]) {
                      setUserPermissions(DEFAULT_PERMISSIONS_BY_ROLE[roleKey])
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol">
                      {newUser.rol || "Seleccionar rol"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Técnico">Técnico</SelectItem>
                    <SelectItem value="Supervisor">Supervisor</SelectItem>
                    <SelectItem value="Administrador">Administrador</SelectItem>
                  </SelectContent>
                </Select>
                {userFormErrors.rol && <p className="text-red-500 text-xs">{userFormErrors.rol}</p>}
              </div>
              <div>
                <Label htmlFor="estado">Estado</Label>
                <Select
                  value={newUser.estado || "Activo"}
                  onValueChange={(value) => setNewUser({ ...newUser, estado: value as Usuario["estado"] })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Activo">Activo</SelectItem>
                    <SelectItem value="Inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {userFormErrors.general && <p className="text-red-500 text-xs">{userFormErrors.general}</p>}
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUserForm(false)
                  setEditingUser(null)
                  setNewUser({ estado: "Activo" })
                  setUserFormErrors({})
                }}
                disabled={usersLoading}
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  // Validate required fields
                  if (!newUser.nombre || !newUser.email || !newUser.rol) {
                    setUserFormErrors({ ...userFormErrors, general: "Por favor complete los campos requeridos." })
                    return
                  }

                  // For new users, password is required
                  if (!editingUser) {
                    if (!newUser.contrasena || newUser.contrasena.trim() === "") {
                      setUserFormErrors({
                        ...userFormErrors,
                        contrasena: "La contraseña es obligatoria para nuevos usuarios",
                      })
                      return
                    }

                    if (newUser.contrasena.length < 6) {
                      setUserFormErrors({
                        ...userFormErrors,
                        contrasena: "La contraseña debe tener al menos 6 caracteres",
                      })
                      return
                    }
                  } else {
                    // For editing users, password is optional but if provided, must be at least 6 chars
                    if (newUser.contrasena && newUser.contrasena.length > 0 && newUser.contrasena.length < 6) {
                      setUserFormErrors({
                        ...userFormErrors,
                        contrasena: "La contraseña debe tener al menos 6 caracteres",
                      })
                      return
                    }
                  }

                  setUsersLoading(true)
                  // Map contrasena to password for the API
                  const usuarioData = {
                    ...newUser,
                    password: newUser.contrasena,
                    contrasena: undefined, // Remove the frontend field
                  }
                  const result = await saveUsuario(usuarioData)

                  if (result.success) {
                    alert("Usuario guardado exitosamente")
                    setShowUserForm(false)
                    setEditingUser(null)
                    setNewUser({ estado: "Activo" })
                    await loadUsers()
                  } else {
                    setUserFormErrors({ general: result.error || "Error al guardar usuario" })
                  }
                  setUsersLoading(false)
                }}
                disabled={usersLoading}
              >
                {usersLoading ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* User Details Modal */}
        <Dialog open={showUserDetails} onOpenChange={setShowUserDetails}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalles del Usuario - {selectedUser?.nombre || "Cargando..."}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* User Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">ID Usuario</Label>
                  <p className="text-sm font-medium">{selectedUser?.id || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Nombre</Label>
                  <p className="text-sm font-medium">{selectedUser?.nombre || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Correo</Label>
                  <p className="text-sm">{selectedUser?.email || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Rol</Label>
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      selectedUser?.rol === "Administrador"
                        ? "bg-blue-100 text-blue-800"
                        : selectedUser?.rol === "Supervisor"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {selectedUser?.rol || "N/A"}
                  </span>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Estado</Label>
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      selectedUser?.estado === "Activo" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {selectedUser?.estado || "N/A"}
                  </span>
                </div>
              </div>



            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  setEditingUser(selectedUser)
                  setShowUserDetails(false)
                  setShowUserForm(true)
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Modificar
              </Button>
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => {
                  // alert("Función de resetear contraseña implementada")
                  setResetPasswordUser(selectedUser)
                  setShowResetPassword(true)
                }}
              >
                <Key className="h-4 w-4 mr-2" />
                Resetear Contraseña
              </Button>
              <Button variant="outline" onClick={() => setShowUserDetails(false)}>
                Cerrar
              </Button>
            </div>
          </DialogContent>
        </Dialog>



        {/* Reset Password Dialog */}
        <Dialog open={showResetPassword} onOpenChange={setShowResetPassword}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Restablecer Contraseña</DialogTitle>
              <p className="text-sm text-gray-600 mt-2">
                Usuario: <span className="font-medium">{resetPasswordUser?.nombre}</span>
              </p>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nueva Contraseña *</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value)
                    setPasswordError("")
                  }}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Contraseña *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    setPasswordError("")
                  }}
                  placeholder="Repita la contraseña"
                />
              </div>
              {passwordError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{passwordError}</AlertDescription>
                </Alert>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowResetPassword(false)
                  setResetPasswordUser(null)
                  setNewPassword("")
                  setConfirmPassword("")
                  setPasswordError("")
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  if (!newPassword || newPassword.length < 6) {
                    setPasswordError("La contraseña debe tener al menos 6 caracteres")
                    return
                  }

                  if (newPassword !== confirmPassword) {
                    setPasswordError("Las contraseñas no coinciden")
                    return
                  }

                  if (!resetPasswordUser) return

                  const result = await resetPassword(resetPasswordUser.id, newPassword)

                  if (result.success) {
                    alert("Contraseña restablecida exitosamente")
                    setShowResetPassword(false)
                    setResetPasswordUser(null)
                    setNewPassword("")
                    setConfirmPassword("")
                    setPasswordError("")
                  } else {
                    setPasswordError(result.error || "Error al restablecer la contraseña")
                  }
                }}
                disabled={usersLoading}
              >
                {usersLoading ? "Restableciendo..." : "Restablecer Contraseña"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // --- Maintenance Rendering Functions ---
  const isOverdue = (dateString: string | Date | undefined): boolean => {
    if (!dateString) return false
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      let dueDate: Date
      if (typeof dateString === 'string') {
        const parts = dateString.split('T')[0].split('-')
        if (parts.length === 3) {
          dueDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
        } else {
          dueDate = new Date(dateString)
        }
      } else {
        dueDate = new Date(dateString)
      }
      
      dueDate.setHours(0, 0, 0, 0)
      return dueDate < today
    } catch (error) {
      console.error('[v0] Error in isOverdue:', error)
      return false
    }
  }

  const isUpcoming = (dateString: string | Date | undefined): boolean => {
    if (!dateString) return false
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      let dueDate: Date
      if (typeof dateString === 'string') {
        const parts = dateString.split('T')[0].split('-')
        if (parts.length === 3) {
          dueDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
        } else {
          dueDate = new Date(dateString)
        }
      } else {
        dueDate = new Date(dateString)
      }
      
      dueDate.setHours(0, 0, 0, 0)
      const nextSevenDays = new Date(today)
      nextSevenDays.setDate(today.getDate() + 7)
      return dueDate >= today && dueDate <= nextSevenDays
    } catch (error) {
      console.error('[v0] Error in isUpcoming:', error)
      return false
    }
  }

  const getMaintenanceStatusColor = (resultado: string | undefined) => {
    switch (resultado?.toLowerCase()) {
      case "completado":
        return "bg-green-100 text-green-800"
      case "pendiente":
        return "bg-yellow-100 text-yellow-800"
      case "vencido":
        return "bg-red-100 text-red-800"
      case "próximo":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Helper functions for calendar view
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const getMaintenanceForDate = (date: Date) => {
    return maintenanceSchedules.filter((m) => {
      try {
        // Parse the date string safely, handling different formats
        let maintenanceDate: Date
        if (typeof m.proximaFecha === 'string') {
          // Handle ISO strings and date strings
          const parts = m.proximaFecha.split('T')[0].split('-')
          if (parts.length === 3) {
            maintenanceDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
          } else {
            maintenanceDate = new Date(m.proximaFecha)
          }
        } else {
          maintenanceDate = new Date(m.proximaFecha)
        }
        
        return (
          maintenanceDate.getDate() === date.getDate() &&
          maintenanceDate.getMonth() === date.getMonth() &&
          maintenanceDate.getFullYear() === date.getFullYear()
        )
      } catch (error) {
        console.error('[v0] Error parsing maintenance date:', m.proximaFecha, error)
        return false
      }
    })
  }

  const getMaintenanceStatus = (maintenance: Mantenimiento) => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      // Parse the date string safely
      let maintenanceDate: Date
      if (typeof maintenance.proximaFecha === 'string') {
        const parts = maintenance.proximaFecha.split('T')[0].split('-')
        if (parts.length === 3) {
          maintenanceDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
        } else {
          maintenanceDate = new Date(maintenance.proximaFecha)
        }
      } else {
        maintenanceDate = new Date(maintenance.proximaFecha)
      }
      
      maintenanceDate.setHours(0, 0, 0, 0)
      const diffDays = Math.ceil((maintenanceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      // Case-insensitive comparison for resultado
      const resultado = maintenance.resultado?.toLowerCase()
      if (resultado === "completado") return "completed"
      if (diffDays < 0) return "overdue"
      if (diffDays <= 7) return "upcoming"
      return "scheduled"
    } catch (error) {
      console.error('[v0] Error calculating maintenance status:', error)
      return "scheduled"
    }
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev)
      if (direction === "prev") {
        newDate.setMonth(newDate.getMonth() - 1)
      } else {
        newDate.setMonth(newDate.getMonth() + 1)
      }
      return newDate
    })
  }

  const goToToday = () => {
    setCurrentMonth(new Date())
  }

  const renderCalendar = () => {
    return (
      <MonthlyMaintenanceCalendar
        maintenances={maintenanceSchedules}
        currentMonth={currentMonth}
        onMonthChange={setCurrentMonth}
        onDateSelect={(date) => {
          const dateStr = date.toISOString().split('T')[0]
          setSelectedMaintenance(null)
          setMaintenanceForm({ proximaFecha: dateStr })
          setShowMaintenanceForm(true)
        }}
        onMaintenanceClick={(maintenance) => {
          setSelectedMaintenance(maintenance as any)
          setShowMaintenanceDetails(true)
        }}
        disabled={maintenanceLoading}
      />
    )
  }

  // Maintenance management functions
  const resetMaintenanceForm = () => {
    setMaintenanceForm({})
    setMaintenanceFormErrors({})
  }

  const handleEditMaintenance = (maintenance: Mantenimiento) => {
    // Format dates for the input (YYYY-MM-DD format)
    const formatDateForInput = (dateString: any) => {
      if (!dateString) return ""
      try {
        const date = new Date(dateString)
        return date.toISOString().split('T')[0]
      } catch {
        return ""
      }
    }

    setSelectedMaintenance(maintenance)
    setMaintenanceForm({
      equipoId: maintenance.equipo_id || maintenance.equipoId,
      tipo: maintenance.tipo,
      frecuencia: maintenance.frecuencia,
      proximaFecha: formatDateForInput(maintenance.proxima_programada || maintenance.proximaFecha),
      ultimaFecha: formatDateForInput(maintenance.ultima_realizacion || maintenance.ultimaFecha),
      observaciones: maintenance.observaciones || maintenance.descripcion,
      descripcion: maintenance.descripcion,
      procedimiento: maintenance.procedimiento,
    })
    setShowMaintenanceForm(true)
    setMaintenanceFormErrors({})
  }

  const handleDeleteMaintenance = async (id: number) => {
    setSelectedMaintenanceToDelete(id)
    setIsDeleteMaintenanceDialogOpen(true)
  }

  const handleCompleteMaintenance = async (maintenance: Mantenimiento) => {
    setMaintenanceLoading(true)
    try {
      // First, complete the maintenance
      const completeResult = await completeMantenimiento(
        maintenance.id,
        {
          tiempo_real: undefined,
          costo: undefined,
          observaciones: `Mantenimiento completado automáticamente`,
          estado_equipo: "operativo",
        },
        currentUser?.id || 1
      )

      if (!completeResult.success) {
        toast({
          variant: "destructive",
          title: "Error al completar mantenimiento",
          description: completeResult.error || "No se pudo completar el mantenimiento",
        })
        return
      }

      // Then create a work order automatically
      const equipoNombre = typeof maintenance.equipo === "object" ? maintenance.equipo.nombre : maintenance.equipo || "Equipo desconocido"
      
      const ordenResult = await saveOrdenTrabajo({
        equipo_id: maintenance.equipo_id,
        tipo: maintenance.tipo || "Mantenimiento",
        prioridad: "media",
        descripcion: `Orden de trabajo generada automáticamente por la finalización del mantenimiento: ${maintenance.descripcion || "Mantenimiento programado"}`,
        estado: "pendiente",
        tiempo_estimado: null,
        costo_estimado: null,
      })

      if (ordenResult.success) {
        toast({
          title: "Mantenimiento completado",
          description: `Mantenimiento completado y orden de trabajo #${ordenResult.data?.numero_orden} creada`,
        })
      } else {
        toast({
          title: "Mantenimiento completado parcialmente",
          description: "El mantenimiento fue completado pero hay problemas creando la orden de trabajo",
        })
      }

      setShowMaintenanceDetails(false)
      await loadMaintenanceSchedules()
      await loadMaintenanceStats()
    } catch (error) {
      console.error("[v0] Error completing maintenance:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo completar el mantenimiento",
      })
    } finally {
      setMaintenanceLoading(false)
    }
  }

  const confirmDeleteMaintenance = async () => {
    if (!selectedMaintenanceToDelete) return

    setMaintenanceLoading(true)
    try {
      const result = await deleteMantenimiento(selectedMaintenanceToDelete)

      if (result.success) {
        toast({
          title: "Mantenimiento eliminado",
          description: "El mantenimiento ha sido eliminado correctamente",
        })
        setIsDeleteMaintenanceDialogOpen(false)
        setSelectedMaintenanceToDelete(null)
        setShowMaintenanceDetails(false)
        await loadMaintenanceSchedules()
      } else {
        toast({
          variant: "destructive",
          title: "Error al eliminar",
          description: result.error || "No se pudo eliminar el mantenimiento",
        })
      }
    } catch (error) {
      console.error("[v0] Error deleting maintenance:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el mantenimiento",
      })
    } finally {
      setMaintenanceLoading(false)
    }
  }

  const handleSaveMaintenanceSchedule = async () => {
    // Clear previous errors
    setMaintenanceFormErrors({})

    // Validate required fields
    const errors: { [key: string]: string } = {}
    if (!maintenanceForm.equipoId) errors.equipoId = "El equipo es requerido"
    if (!maintenanceForm.tipo) errors.tipo = "El tipo es requerido"
    if (!maintenanceForm.frecuencia) errors.frecuencia = "La frecuencia es requerida"
    if (!maintenanceForm.proximaFecha) errors.proximaFecha = "La próxima fecha es requerida"
    if (!maintenanceForm.observaciones?.trim()) errors.observaciones = "Las observaciones son requeridas"

    // Validate dates
    if (maintenanceForm.proximaFecha && maintenanceForm.ultimaFecha) {
      const proximaFecha = new Date(maintenanceForm.proximaFecha)
      const ultimaFecha = new Date(maintenanceForm.ultimaFecha)
      
      if (ultimaFecha > proximaFecha) {
        errors.ultimaFecha = "La última fecha debe ser anterior o igual a la próxima fecha"
      }
    }

    if (maintenanceForm.ultimaFecha && !maintenanceForm.proximaFecha) {
      errors.proximaFecha = "La próxima fecha es requerida si se establece una última fecha"
    }

    if (Object.keys(errors).length > 0) {
      setMaintenanceFormErrors(errors)
      return
    }

    setMaintenanceLoading(true)

    try {
      let result
      
      if (selectedMaintenance?.id) {
        // Update existing maintenance
        result = await updateMantenimiento(selectedMaintenance.id, maintenanceForm)
      } else {
        // Create new maintenance
        result = await createMantenimiento(maintenanceForm)
      }

      if (result.success) {
        toast({
          title: selectedMaintenance ? "Mantenimiento actualizado" : "Mantenimiento creado",
          description: selectedMaintenance
            ? "El mantenimiento ha sido actualizado correctamente"
            : "El mantenimiento ha sido creado correctamente",
        })
        setShowMaintenanceForm(false)
        resetMaintenanceForm()
        setSelectedMaintenance(null)
        await loadMaintenanceSchedules()
        await loadMaintenanceStats()
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo guardar el mantenimiento",
        })
        setMaintenanceFormErrors({ general: result.error || "Error al guardar" })
      }
    } catch (error) {
      console.error("[v0] Error saving maintenance:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar el mantenimiento",
      })
      setMaintenanceFormErrors({ general: "Error al guardar el mantenimiento" })
    } finally {
      setMaintenanceLoading(false)
    }
  }



  const renderMantenimiento = () => {
    // Filter maintenance schedules based on search term and filters
    const filteredMaintenanceSchedules = maintenanceSchedules.filter((m: any) => {
      // Apply search term filter
      const searchLower = maintenanceSearchTerm.toLowerCase()
      const equipoNombre = typeof m.equipo === 'object' ? m.equipo?.nombre : m.equipo
      const matchSearch = !maintenanceSearchTerm || 
        (equipoNombre && equipoNombre.toLowerCase().includes(searchLower)) ||
        (m.tipo && m.tipo.toLowerCase().includes(searchLower)) ||
        (m.frecuencia && m.frecuencia.toLowerCase().includes(searchLower)) ||
        (m.observaciones && m.observaciones.toLowerCase().includes(searchLower)) ||
        (m.id && m.id.toString().includes(searchLower))
      
      // Apply tipo filter
      const matchTipo = maintenanceFilters.tipo === "all" || m.tipo === maintenanceFilters.tipo
      
      // Apply frecuencia filter
      const matchFrecuencia = maintenanceFilters.frecuencia === "all" || m.frecuencia === maintenanceFilters.frecuencia
      
      return matchSearch && matchTipo && matchFrecuencia
    })
    return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{""}</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1">
            <Button
              variant={!calendarView ? "default" : "outline"}
              size="sm"
              onClick={() => setCalendarView(false)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Lista
            </Button>
            <Button
              variant={calendarView ? "default" : "outline"}
              size="sm"
              onClick={() => setCalendarView(true)}
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              Calendario
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setShowMaintenanceForm(true)
                setSelectedMaintenance(null)
                setMaintenanceForm({ resultado: "pendiente" })
                if (users.length === 0) {
                  const loadUsers = async () => {
                    try {
                      const response = await fetchUsuarios({ per_page: 1000, estado: "activo" })
                      setUsers(response.data)
                    } catch (error) {
                      console.error("Error loading users for maintenance form:", error)
                    }
                  }
                  loadUsers()
                }
              }}
            >
              <Plus className="h-4 w-4" />
              Nuevo Mantenimiento
            </Button>
          </div>
        </div>
      </div>

      {/* Maintenance Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Vencidos</p>
              <p className="text-3xl font-bold">{maintenanceStats.vencidos}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Próximos (7 días)</p>
              <p className="text-3xl font-bold">{maintenanceStats.proximos}</p>
            </div>
            <Bell className="h-8 w-8 text-yellow-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Completados</p>
              <p className="text-3xl font-bold">{maintenanceStats.completados}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Programados</p>
              <p className="text-3xl font-bold">{maintenanceStats.total}</p>
            </div>
            <Wrench className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Mantenimientos Programados</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Buscar:</span>
                <Input
                  className="w-48"
                  placeholder="Equipo, tipo, observaciones..."
                  value={maintenanceSearchTerm}
                  onChange={(e) => setMaintenanceSearchTerm(e.target.value)}
                />
              </div>
              <Select
                value={maintenanceFilters.tipo}
                onValueChange={(value) => setMaintenanceFilters({ ...maintenanceFilters, tipo: value })}
              >
                <SelectTrigger className="w-36 min-w-32">
                  <SelectValue placeholder="Tipo de Mantenimiento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="calibracion">Calibracion</SelectItem>
                  <SelectItem value="inspeccion">Inspeccion</SelectItem>
                  <SelectItem value="limpieza">Limpieza</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={maintenanceFilters.frecuencia}
                onValueChange={(value) => setMaintenanceFilters({ ...maintenanceFilters, frecuencia: value })}
              >
                <SelectTrigger className="w-36 min-w-32">
                  <SelectValue placeholder="Frecuencia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las frecuencias</SelectItem>
                  <SelectItem value="mensual">Mensual</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMaintenanceFilters({ tipo: "all", frecuencia: "all" })
                  setMaintenanceSearchTerm("")
                }}
              >
                Limpiar
              </Button>
            </div>
          </div>
          {maintenanceLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
              <p className="text-gray-600">Cargando mantenimientos...</p>
            </div>
          ) : calendarView ? (
            renderCalendar()
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">ID Mantenimiento</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Nombre Equipo</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Frecuencia</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Próxima Fecha</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Resultado</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Observaciones</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredMaintenanceSchedules.map((m: any) => (
                    <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-600 font-mono">{m.id}</td>
                      <td className="px-4 py-2 font-medium">{typeof m.equipo === 'object' ? m.equipo?.nombre : m.equipo || "N/A"}</td>
                      <td className="px-4 py-2">{m.tipo || "N/A"}</td>
                      <td className="px-4 py-2">{m.frecuencia || "N/A"}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`p-1 rounded-lg ${isOverdue(m.proximaFecha) ? "bg-red-100 text-red-800 border border-red-200" : isUpcoming(m.proximaFecha) ? "bg-yellow-100 text-yellow-800 border border-yellow-200" : "bg-green-100 text-green-800 border border-green-200"}`}
                        >
                          {formatDate(m.proximaFecha)}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {(() => {
                          let resultado
                          if (m.completado) {
                            resultado = "completado"
                          } else {
                            resultado = m.resultado || (isOverdue(m.proxima_programada) ? "vencido" : isUpcoming(m.proxima_programada) ? "próximo" : "pendiente")
                          }
                          const displayResultado = resultado.charAt(0).toUpperCase() + resultado.slice(1)
                          return <Badge className={`${getMaintenanceStatusColor(resultado)}`}>{displayResultado}</Badge>
                        })()}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate" title={m.observaciones}>
                        {m.observaciones || "N/A"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedMaintenance(m)
                                  setShowMaintenanceDetails(true)
                                }}
                              >
                                {/* CHANGE: Added blue color to Eye icon */}
                                <Eye className="h-4 w-4 text-blue-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver detalles</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="outline" onClick={() => handleEditMaintenance(m)}>
                                {/* CHANGE: Added amber/orange color to Modificar button */}
                                <Edit className="h-4 w-4 text-amber-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:text-green-700 bg-transparent"
                                onClick={() => handleCompleteMaintenance(m)}
                                disabled={m.completado}
                              >
                                {/* CHANGE: Added green checkmark for complete maintenance */}
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {m.completado ? "Mantenimiento ya completado" : "Completar mantenimiento"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700 bg-transparent"
                                onClick={() => handleDeleteMaintenance(m.id)}
                                disabled={m.programada_orden_generada}
                              >
                                {/* CHANGE: Trash icon already inherits red color from parent className */}
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {m.programada_orden_generada
                                ? "No se puede eliminar: mantenimiento ya programado/orden generada"
                                : "Eliminar"}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredMaintenanceSchedules.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No se encontraron mantenimientos con los criterios de búsqueda.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Maintenance Form Modal */}
      <Dialog
        open={showMaintenanceForm}
        onOpenChange={(isOpen) => {
          setShowMaintenanceForm(isOpen)
          if (!isOpen) resetMaintenanceForm()
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedMaintenance ? "Editar Mantenimiento" : "Programar Nuevo Mantenimiento"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="equipoId">Equipo *</Label>
              <EquipmentCombobox
                equipment={equipment}
                value={maintenanceForm.equipoId?.toString() || ""}
                onValueChange={(value) => {
                  const selectedEquipo = equipment.find((eq) => eq.id.toString() === value)
                  setMaintenanceForm({
                    ...maintenanceForm,
                    equipoId: Number.parseInt(value),
                    equipo: selectedEquipo?.nombre,
                  })
                  setMaintenanceFormErrors({ ...maintenanceFormErrors, equipoId: "" })
                }}
                error={!!maintenanceFormErrors.equipoId}
              />
              {maintenanceFormErrors.equipoId && (
                <p className="text-red-500 text-xs">{maintenanceFormErrors.equipoId}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Mantenimiento *</Label>
              <Select
                value={maintenanceForm.tipo || ""}
                onValueChange={(value) => {
                  setMaintenanceForm({ ...maintenanceForm, tipo: value })
                  setMaintenanceFormErrors({ ...maintenanceFormErrors, tipo: "" })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="calibracion">Calibración</SelectItem>
                  <SelectItem value="inspeccion">Inspección</SelectItem>
                  <SelectItem value="limpieza">Limpieza</SelectItem>
                </SelectContent>
              </Select>
              {maintenanceFormErrors.tipo && <p className="text-red-500 text-xs">{maintenanceFormErrors.tipo}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="frecuencia">Frecuencia *</Label>
              <Select
                value={maintenanceForm.frecuencia || ""}
                onValueChange={(value) => {
                  setMaintenanceForm({ ...maintenanceForm, frecuencia: value })
                  setMaintenanceFormErrors({ ...maintenanceFormErrors, frecuencia: "" })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar frecuencia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensual">Mensual</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
              {maintenanceFormErrors.frecuencia && (
                <p className="text-red-500 text-xs">{maintenanceFormErrors.frecuencia}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="proximaFecha">Próxima Fecha *</Label>
              <Input
                id="proximaFecha"
                type="date"
                value={maintenanceForm.proximaFecha || ""}
                onChange={(e) => {
                  setMaintenanceForm({ ...maintenanceForm, proximaFecha: e.target.value })
                  setMaintenanceFormErrors({ ...maintenanceFormErrors, proximaFecha: "" })
                }}
              />
              {maintenanceFormErrors.proximaFecha && (
                <p className="text-red-500 text-xs">{maintenanceFormErrors.proximaFecha}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ultimaFecha">Última Fecha</Label>
              <Input
                id="ultimaFecha"
                type="date"
                value={maintenanceForm.ultimaFecha || ""}
                onChange={(e) => {
                  setMaintenanceForm({ ...maintenanceForm, ultimaFecha: e.target.value })
                  setMaintenanceFormErrors({ ...maintenanceFormErrors, ultimaFecha: "" })
                }}
                className={maintenanceFormErrors.ultimaFecha ? "border-red-500" : ""}
              />
              {maintenanceFormErrors.ultimaFecha && (
                <p className="text-red-500 text-xs">{maintenanceFormErrors.ultimaFecha}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                placeholder="Notas sobre el mantenimiento"
                value={maintenanceForm.observaciones || ""}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, observaciones: e.target.value })}
              />
            </div>
          </div>
          {maintenanceFormErrors.general && <p className="text-red-500 text-xs">{maintenanceFormErrors.general}</p>}
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowMaintenanceForm(false)
                resetMaintenanceForm()
              }}
              disabled={maintenanceLoading}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveMaintenanceSchedule} disabled={maintenanceLoading}>
              {maintenanceLoading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Maintenance Details Dialog */}
      <Dialog open={showMaintenanceDetails} onOpenChange={setShowMaintenanceDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
                <DialogTitle>Detalles del Mantenimiento - {typeof selectedMaintenance?.equipo === 'object' ? selectedMaintenance?.equipo?.nombre : selectedMaintenance?.equipo || "Cargando..."}</DialogTitle>
          </DialogHeader>
          {selectedMaintenance && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <strong>ID:</strong> {selectedMaintenance.id || "N/A"}
                </div>
                  <div>
                    <strong>Equipo:</strong> {typeof selectedMaintenance.equipo === 'object' ? selectedMaintenance.equipo?.nombre : selectedMaintenance.equipo || "N/A"}
                  </div>
                <div>
                  <strong>Tipo:</strong> {selectedMaintenance.tipo || "N/A"}
                </div>
                <div>
                  <strong>Frecuencia:</strong> {selectedMaintenance.frecuencia || "N/A"}
                </div>
                <div>
                  <strong>Técnico Asignado:</strong> {selectedMaintenance.responsableNombre || "Sin asignar"}
                </div>
                <div>
                  <strong>Próxima Fecha:</strong>
                  <span
                    className={`ml-2 p-1 rounded-lg ${isOverdue(selectedMaintenance.proximaFecha) ? "bg-red-100 text-red-800 border border-red-200" : isUpcoming(selectedMaintenance.proximaFecha) ? "bg-yellow-100 text-yellow-800 border border-yellow-200" : "bg-green-100 text-green-800 border border-green-200"}`}
                  >
                    {formatDate(selectedMaintenance.proximaFecha)}
                  </span>
                </div>
                <div>
                  <strong>Última Fecha:</strong> {formatDate(selectedMaintenance.ultimaFecha)}
                </div>
                <div>
                  <strong>Estado:</strong>
                  <Badge className={`ml-2 ${getMaintenanceStatusColor(selectedMaintenance.completado ? "Completado" : isOverdue(selectedMaintenance.proximaFecha) ? "Vencido" : isUpcoming(selectedMaintenance.proximaFecha) ? "Próximo" : "Programado")}`}>
                    {selectedMaintenance.completado ? "Completado" : isOverdue(selectedMaintenance.proximaFecha) ? "Vencido" : isUpcoming(selectedMaintenance.proximaFecha) ? "Próximo" : "Programado"}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Observaciones</h3>
                <p className="text-sm text-gray-700">{selectedMaintenance.observaciones || "Sin observaciones."}</p>
              </div>
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => handleEditMaintenance(selectedMaintenance)}
                  className="text-amber-600 hover:bg-amber-50 border-amber-300"
                >
                  <Edit className="h-4 w-4 mr-2 text-amber-600" />
                  Modificar
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600 hover:bg-red-50 border-red-300 bg-transparent"
                  onClick={() => handleDeleteMaintenance(selectedMaintenance.id)}
                  disabled={maintenanceLoading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {maintenanceLoading ? "Eliminando..." : "Eliminar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
  }

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true)
    try {
      let data: any[] | { equipos: any[]; mantenimientos: any[] } = []

      if (reportType === "equipos") {
        const response = await fetchEquipos({})
        data = response.data
      } else if (reportType === "mantenimientos") {
        // Ensure maintenanceSchedules is loaded and filtered correctly before passing
        await loadMaintenanceSchedules() // Reload just in case

        const enrichedData = await Promise.all(
          maintenanceSchedules.map(async (mant: any) => {
            try {
              // Find equipment - mant.equipo might already contain the equipment object or we need equipoId
              const equipoId = mant.equipoId || mant.equipo_id || (typeof mant.equipo === 'object' ? mant.equipo?.id : mant.equipo)
              const equipo = equipment.find((eq) => eq.id === equipoId)
              return {
                ...mant,
                estadoEquipo: equipo?.estadoEquipo || equipo?.estado || "-",
              }
            } catch (error) {
              console.error("[v0] Error fetching equipment for maintenance:", error)
              return { ...mant, estadoEquipo: "-" }
            }
          }),
        )

        data = enrichedData
      } else if (reportType === "ordenes") {
        // Ensure workOrders is loaded and filtered correctly before passing
        await loadWorkOrders() // Reload just in case
        data = workOrders
      } else if (reportType === "usuarios") {
        const response = await fetchUsuarios({ perPage: 1000 })
        data = response.data
      } else if (reportType === "cronograma") {
        const equiposResponse = await fetchEquipos({})
        await loadMaintenanceSchedules()

        data = {
          equipos: equiposResponse.data,
          mantenimientos: maintenanceSchedules,
        }
      }

      if (reportType !== "cronograma" && reportType !== "usuarios" && (reportFechaInicio || reportFechaFin)) {
        data = (data as any[]).filter((item) => {
          // Find the relevant date field in the item
          const itemDateString =
            item.proximaFecha || // For Mantenimientos
            item.fechaCreacion ||
            item.fecha_creacion || // For OrdenesTrabajo
            item.fechaInstalacion ||
            item.fecha_instalacion // For Equipos

          if (!itemDateString) return false // Skip if no date is found

          const itemDate = new Date(itemDateString)
          const inicio = reportFechaInicio ? new Date(reportFechaInicio) : new Date(0) // Start of epoch
          const fin = reportFechaFin ? new Date(reportFechaFin) : new Date() // Today

          // Ensure dates are valid before comparison
          if (isNaN(itemDate.getTime()) || isNaN(inicio.getTime()) || isNaN(fin.getTime())) return false

          return itemDate >= inicio && itemDate <= fin
        })
      }

      // CHANGE: Added await for PDF generation with logos
      const doc = await generatePDF({
        tipo: reportType,
        fechaInicio: reportFechaInicio,
        fechaFin: reportFechaFin,
        data,
      })

      // Download PDF
      const filename = `Reporte_${reportType}_${new Date().toISOString().split("T")[0]}.pdf`
      downloadPDF(doc, filename)

      toast({
        title: "PDF generado",
        description: "El reporte ha sido descargado correctamente",
      })
    } catch (error) {
      console.error("Error generating report:", error)
      alert("Error al generar el reporte. Por favor intente nuevamente.")
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const renderReportes = () => (
    <div id="reports-section" className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div></div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <FileText className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Configuración del Reporte</h3>
          </div>

          <div className="grid gap-6">
            <div className="grid gap-3">
              <Label htmlFor="tipo-reporte" className="text-sm font-medium">
                Tipo de Reporte *
              </Label>
              <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
                <SelectTrigger id="tipo-reporte" className="w-full">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equipos">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      <span>Equipos Biomédicos</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="mantenimientos">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Mantenimientos Programados</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="ordenes">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      <span>Órdenes de Trabajo</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="cronograma">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Cronograma de Mantenimiento</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="usuarios">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>Usuarios</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Seleccione el tipo de informaci��n que desea incluir en el reporte</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-3">
                <Label htmlFor="fecha-inicio" className="text-sm font-medium">
                  Fecha Inicio
                </Label>
                <Input
                  id="fecha-inicio"
                  type="date"
                  value={reportFechaInicio}
                  onChange={(e) => setReportFechaInicio(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">Opcional: Filtrar desde esta fecha</p>
              </div>

              <div className="grid gap-3">
                <Label htmlFor="fecha-fin" className="text-sm font-medium">
                  Fecha Fin
                </Label>
                <Input
                  id="fecha-fin"
                  type="date"
                  value={reportFechaFin}
                  onChange={(e) => setReportFechaFin(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">Opcional: Filtrar hasta esta fecha</p>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t">
              <Button
                onClick={handleGenerateReport}
                disabled={isGeneratingReport}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isGeneratingReport ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Generar Reporte PDF
                  </>
                )}
              </Button>

              <div className="flex-1" />

              <div className="text-sm text-gray-500">
                {reportType === "equipos" && `${equipment.length} equipos`}
                {reportType === "mantenimientos" && `${maintenanceSchedules.length} mantenimientos`}
                {reportType === "ordenes" && `${workOrders.length} órdenes`}
                {reportType === "usuarios" && `${users.length} usuarios`}
                {reportType === "cronograma" &&
                  `Equipos: ${equipment.length}, Mantenimientos: ${maintenanceSchedules.length}`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Preview Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-2">Información del Reporte</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Los reportes se generan en formato PDF profesional</li>
                <li>• Incluyen tablas detalladas y estadísticas resumen</li>
                <li>• Los filtros de fecha son opcionales (sin fechas = todos los registros)</li>
                <li>• El archivo se descargará automáticamente al generarse</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

      // Don't filter again on client - already filtered on server by fetchAuditLogs
      const totalPagesLogs = auditLogs.length === 0 ? 1 : Math.ceil(auditLogs.length / logsPerPage)
      const paginatedLogs = auditLogs.slice((logCurrentPage - 1) * logsPerPage, logCurrentPage * logsPerPage)

  const renderAuditoria = () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold">Auditoría</h1>
          <p className="text-muted-foreground">Revisa los registros de actividad del sistema.</p>
        </div>
        <button
          onClick={loadAuditLogs}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Actualizar
        </button>
      </div>

      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Filtros</h3>
          <div className="grid gap-6">
            <div>
              <Label htmlFor="log-search" className="text-sm font-medium">
                Buscar
              </Label>
              <Input
                id="log-search"
                placeholder="Buscar por descripción, usuario o módulo..."
                value={logSearchTerm}
                onChange={(e) => {
                  setLogSearchTerm(e.target.value)
                  setLogCurrentPage(1)
                }}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="log-action-filter" className="text-sm font-medium">
                Filtrar por Acción
              </Label>
              <select
                id="log-action-filter"
                value={logActionFilter}
                onChange={(e) => {
                  setLogActionFilter(e.target.value)
                  setLogCurrentPage(1)
                }}
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todas las acciones</option>
                <option value="Crear">Crear</option>
                <option value="Editar">Editar</option>
                <option value="Eliminar">Eliminar</option>
              </select>
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              Los filtros se aplican automáticamente
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Logs del Sistema</h3>
            <p className="text-sm text-muted-foreground">
              {logsLoading ? "Cargando..." : `${auditLogs.length} registro${auditLogs.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          {logsLoading ? (
            <div className="py-8 text-center">
              <div className="inline-block">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
              <p className="text-sm text-gray-500 mt-2">Cargando registros de auditoría...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Usuario</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Acción</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Módulo</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Descripción</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedLogs.length > 0 ? (
                    paginatedLogs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{log.created_at ? new Date(log.created_at).toLocaleString('es-ES') : '-'}</td>
                        <td className="px-4 py-3 text-sm">{log.usuario?.nombre || 'Sistema'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              log.accion === "Crear"
                                ? "bg-green-100 text-green-800"
                                : log.accion === "Editar"
                                  ? "bg-blue-100 text-blue-800"
                                  : log.accion === "Eliminar"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {log.accion}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{log.modulo}</td>
                        <td className="px-4 py-3 text-sm">{log.descripcion}</td>
                      </tr>
                    ))
                  ) : auditLogs.length === 0 && (logSearchTerm !== "" || logActionFilter !== "all") ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        <p className="font-medium">No se encontraron registros</p>
                        <p className="text-sm">Intenta cambiar los filtros de búsqueda o selecciona "Todas las acciones"</p>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No hay registros de auditoría
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {totalPagesLogs > 1 && (
  <div className="mt-4 flex items-center justify-between">
  <p className="text-sm text-gray-600">
  Página {logCurrentPage} de {totalPagesLogs} ({auditLogs.length} registros)
  </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setLogCurrentPage(Math.max(1, logCurrentPage - 1))}
                  disabled={logCurrentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setLogCurrentPage(Math.min(totalPagesLogs, logCurrentPage + 1))}
                  disabled={logCurrentPage === totalPagesLogs}
                  className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  // ADDED: Updated renderConfiguracion
  const renderConfiguracion = () => (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-muted-foreground">Configura las opciones del sistema</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Información del Hospital</h3>
          <div className="grid gap-6">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Logo del Hospital</label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center overflow-hidden">
                  {isMounted ? (
                    <img src={hospitalLogo || "/logo.png"} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full bg-gray-200 animate-pulse rounded" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {/* Update logo upload input to use the new handler */}
                  <input type="file" accept="image/*" className="hidden" id="logo-upload" onChange={handleLogoChange} />
                  <Button variant="outline" size="sm" onClick={() => document.getElementById("logo-upload")?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Subir Logo
                  </Button>
                  <p className="text-xs text-gray-500">PNG, JPG hasta 2MB</p>
                </div>
              </div>
            </div>
            <div className="grid gap-2"></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Gestionar Ubicaciones</h3>
          <div className="grid gap-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nueva ubicación (ej: Cardiología)"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="flex-1 border rounded px-3 py-2 text-sm"
                onKeyPress={(e) => {
                  if (e.key === "Enter" && newLocation.trim()) {
                    if (!configLocations.includes(newLocation.trim())) {
                      setConfigLocations([...configLocations, newLocation.trim()])
                      setNewLocation("")
                    }
                  }
                }}
              />
              <Button
                onClick={() => {
                  if (newLocation.trim() && !configLocations.includes(newLocation.trim())) {
                    setConfigLocations([...configLocations, newLocation.trim()])
                    setNewLocation("")
                  }
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Añadir
              </Button>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Ubicaciones Actuales</label>
              <div className="flex flex-wrap gap-2">
                {configLocations.map((location, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                  >
                    <Building className="h-3 w-3" />
                    {location}
                    <button
                      onClick={() => {
                        setConfigLocations(configLocations.filter((_, i) => i !== index))
                      }}
                      className="ml-1 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Gestionar Fabricantes</h3>
          <div className="grid gap-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nuevo fabricante (ej: Hitachi)"
                value={newManufacturer}
                onChange={(e) => setNewManufacturer(e.target.value)}
                className="flex-1 border rounded px-3 py-2 text-sm"
                onKeyPress={(e) => {
                  if (e.key === "Enter" && newManufacturer.trim()) {
                    if (!configManufacturers.includes(newManufacturer.trim())) {
                      setConfigManufacturers([...configManufacturers, newManufacturer.trim()])
                      setNewManufacturer("")
                    }
                  }
                }}
              />
              <Button
                onClick={() => {
                  if (newManufacturer.trim() && !configManufacturers.includes(newManufacturer.trim())) {
                    setConfigManufacturers([...configManufacturers, newManufacturer.trim()])
                    setNewManufacturer("")
                  }
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Añadir
              </Button>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Fabricantes Actuales</label>
              <div className="flex flex-wrap gap-2">
                {configManufacturers.map((manufacturer, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm"
                  >
                    <Briefcase className="h-3 w-3" />
                    {manufacturer}
                    <button
                      onClick={() => {
                        setConfigManufacturers(configManufacturers.filter((_, i) => i !== index))
                      }}
                      className="ml-1 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button className="w-fit">
        <Save className="h-4 w-4 mr-2" />
        Guardar Todas las Configuraciones
      </Button>
    </div>
  )



  const handleEditEquipment = (equipo: Equipment) => {
    // Format dates for input fields (YYYY-MM-DD format)
    const formatDateForInput = (dateString: any) => {
      if (!dateString) return ""
      try {
        const date = new Date(dateString)
        return date.toISOString().split('T')[0]
      } catch {
        return ""
      }
    }

    // Set the equipment form with all fields from the selected equipment
    setEquipmentForm({
      id: equipo.id,
      numeroSerie: equipo.numeroSerie || "",
      nombre: equipo.nombre || "",
      modelo: equipo.modelo || "",
      fabricante: equipo.fabricante || "",
      ubicacion: equipo.ubicacion || "",
      estado: equipo.estado || "operativo",
      voltaje: equipo.voltaje || "",
      fechaInstalacion: formatDateForInput(equipo.fechaInstalacion),
      frecuencia: equipo.frecuencia || "",
      fechaRetiro: formatDateForInput(equipo.fechaRetiro),
      codigoInstitucional: equipo.codigoInstitucional || "",
      servicio: equipo.servicio || "",
      vencimientoGarantia: formatDateForInput(equipo.vencimientoGarantia),
      fechaIngreso: formatDateForInput(equipo.fechaIngreso),
      procedencia: equipo.procedencia || "",
      potencia: equipo.potencia || "",
      corriente: equipo.corriente || "",
      otrosEspecificaciones: equipo.otrosEspecificaciones || "",
      accesoriosConsumibles: equipo.accesoriosConsumibles || "",
      estadoEquipo: equipo.estadoEquipo || "operativo",
      manualUsuario: equipo.manualUsuario || false,
      manualServicio: equipo.manualServicio || false,
      nivelRiesgo: equipo.nivelRiesgo || "",
      proveedorNombre: equipo.proveedorNombre || "",
      proveedorDireccion: equipo.proveedorDireccion || "",
      proveedorTelefono: equipo.proveedorTelefono || "",
      observaciones: equipo.observaciones || "",
    })

    // Also try to load complete details from API in background
    ;(async () => {
      try {
        const details = await getEquipo(equipo.id)
        if (details) {
          const transformed = transformEquipoToEquipment(details)
          setEquipmentForm((prevForm) => ({
            ...prevForm,
            numeroSerie: transformed.numeroSerie || prevForm.numeroSerie,
            codigoInstitucional: transformed.codigoInstitucional || prevForm.codigoInstitucional,
            fechaIngreso: formatDateForInput(transformed.fechaIngreso) || prevForm.fechaIngreso,
            vencimientoGarantia: formatDateForInput(transformed.vencimientoGarantia) || prevForm.vencimientoGarantia,
            fechaInstalacion: formatDateForInput(transformed.fechaInstalacion) || prevForm.fechaInstalacion,
            otrosEspecificaciones: transformed.otrosEspecificaciones || prevForm.otrosEspecificaciones,
            accesoriosConsumibles: transformed.accesoriosConsumibles || prevForm.accesoriosConsumibles,
            estadoEquipo: transformed.estadoEquipo || prevForm.estadoEquipo,
            nivelRiesgo: transformed.nivelRiesgo || prevForm.nivelRiesgo,
            proveedorNombre: transformed.proveedorNombre || prevForm.proveedorNombre,
            proveedorDireccion: transformed.proveedorDireccion || prevForm.proveedorDireccion,
            proveedorTelefono: transformed.proveedorTelefono || prevForm.proveedorTelefono,
            observaciones: transformed.observaciones || prevForm.observaciones, // Added to keep observations in edit form
          }))
        }
      } catch (err) {
        console.error("[v0] Error loading additional details:", err)
      }
    })()

    setEditingEquipment(true)
    setShowEquipmentForm(true) // Open the form
  }

  // Added the new function to generate technical sheets
  const handleGenerateEquipmentTechnicalSheet = async (equipment: Equipment) => {
    try {
      const doc = await generateEquipmentTechnicalSheet(equipment)
      downloadPDF(doc, `ficha-tecnica-${equipment.numeroSerie || equipment.id}.pdf`)
    } catch (error) {
      console.error("[v0] Error generating technical sheet:", error)
      alert("Error al generar la ficha técnica. Por favor intente nuevamente.")
    }
  }

  const handleUserLogin = (user: Usuario) => {
    const roletype = user.rol.toLowerCase() as RoleType
    const currentUserWithPermissions: CurrentUser = {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: roletype,
      permissions: (user.permissions as Record<PermissionKey, boolean> | undefined) || DEFAULT_PERMISSIONS_BY_ROLE[roletype],
    }
    setCurrentUser(currentUserWithPermissions)
    setUserRole(roletype)
  }

  const canViewSection = (section: string) => {
    return canAccessSection(currentUser, section)
  }

  // The useEffect for loading notifications is now at the top level.

  const handleMarkNotificationAsRead = useCallback(async (id: number) => {
    try {
      const { markNotificationAsRead } = await import("@/app/actions/notificaciones")
      await markNotificationAsRead(id, currentUser?.id)
      await loadNotifications()
    } catch (error) {
      console.error("[v0] Error marking notification as read:", error)
    }
  }, [currentUser?.id])

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      const { markAllNotificationsAsRead } = await import("@/app/actions/notificaciones")
      await markAllNotificationsAsRead(currentUser?.id)
      await loadNotifications()
    } catch (error) {
      console.error("[v0] Error marking all notifications as read:", error)
    }
  }, [currentUser?.id])

  // ADDED: Logo change handler
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const logoUrl = reader.result as string
        setHospitalLogo(logoUrl)
        
        // Save logo to database
        const result = await saveHospitalLogo(logoUrl)
        if (result.success) {
          // Also save to localStorage for immediate access on login page
          if (typeof window !== 'undefined') {
            localStorage.setItem('hospitalLogo', logoUrl)
          }
          
          toast({
            title: "Logo actualizado",
            description: "El logo del hospital se ha guardado correctamente.",
          })
        } else {
          toast({
            title: "Error",
            description: result.error || "No se pudo guardar el logo.",
            variant: "destructive",
          })
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const renderContent = () => {
    if (!currentUser) {
      if (loading) {
        return (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando dashboard...</p>
            </div>
          </div>
        )
      }
      // If not loading but still no user, show loading briefly in case data is being fetched
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Inicializando...</p>
          </div>
        </div>
      )
    }

    if (activeSection === "equipos" && !canViewSection("equipos")) {
      return (
        <div className="flex items-center justify-center min-h-[400px] bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">Acceso Denegado</h3>
            <p className="text-gray-600 mt-2">No tienes permisos para acceder a Gestión de Equipos</p>
          </div>
        </div>
      )
    }

    if (activeSection === "tecnicos" && !canViewSection("tecnicos")) {
      return (
        <div className="flex items-center justify-center min-h-[400px] bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">Acceso Denegado</h3>
            <p className="text-gray-600 mt-2">No tienes permisos para acceder a Gesti��n de Usuarios</p>
          </div>
        </div>
      )
    }

    if (activeSection === "auditoria" && !canViewSection("auditoria")) {
      return (
        <div className="flex items-center justify-center min-h-[400px] bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">Acceso Denegado</h3>
            <p className="text-gray-600 mt-2">No tienes permisos para acceder a los Logs de Auditoría</p>
          </div>
        </div>
      )
    }

    if (activeSection === "configuracion" && !canViewSection("configuracion")) {
      return (
        <div className="flex items-center justify-center min-h-[400px] bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">Acceso Denegado</h3>
            <p className="text-gray-600 mt-2">No tienes permisos para acceder a Configuración</p>
          </div>
        </div>
      )
    }

    // ... existing rendering logic for other sections ...
    switch (activeSection) {
      case "dashboard":
        return renderDashboard()
      case "equipos":
        return renderGestionEquipos()
      case "tecnicos":
        return renderUsuarios()
      case "ordenes":
        return renderOrdenes()
      case "mantenimiento":
        return renderMantenimiento()
      case "reportes":
        return renderReportes()
      case "auditoria":
        return renderAuditoria()
      case "configuracion":
        return renderConfiguracion()
      default:
        return renderDashboard()
    }
  }

  const handleSectionChange = (section: string) => {
    setActiveSection(section)
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {authChecked && (
        <AppSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          userRole={userRole}
          hospitalLogo={hospitalLogo}
        />
      )}
      {!authChecked ? (
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600">Cargando...</p>
          </div>
        </main>
      ) : (
      <main className="flex-1 w-full">
        <AppHeader
          currentUser={currentUser}
          hospitalLogo={hospitalLogo}
          unreadCount={unreadCount}
          notifications={notifications}
          handleMarkNotificationAsRead={handleMarkNotificationAsRead}
          handleMarkAllAsRead={handleMarkAllAsRead}
          setActiveSection={setActiveSection}
        />
        <div className="p-6">{renderContent()}</div>
      </main>
      )}

      {/* EQUIPMENT DELETE CONFIRMATION DIALOG */}
      <Dialog open={isDeleteEquipmentDialogOpen} onOpenChange={setIsDeleteEquipmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Está seguro de que desea eliminar este equipo? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteEquipmentDialogOpen(false)
                setSelectedEquipmentToDelete(null)
              }}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDeleteEquipment} disabled={equipmentLoading}>
              {equipmentLoading ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* USER DELETE CONFIRMATION DIALOG */}
      <Dialog open={isDeleteUserDialogOpen} onOpenChange={setIsDeleteUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Est�� seguro de que desea eliminar este usuario? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteUserDialogOpen(false)
                setSelectedUserToDelete(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!selectedUserToDelete) {
                  console.log("[v0] Delete user: No user selected")
                  return
                }

                console.log("[v0] Delete user: Starting deletion for id:", selectedUserToDelete)
                console.log("[v0] Delete user: Current user id:", currentUser?.id)
                const result = await removeUsuario(selectedUserToDelete, currentUser?.id)
                console.log("[v0] Delete user: Result:", result)
                
                if (result.success) {
                  toast({
                    title: "Usuario eliminado",
                    description: "El usuario ha sido eliminado exitosamente",
                  })
                  setIsDeleteUserDialogOpen(false)
                  setSelectedUserToDelete(null)
                  await loadUsers()
                } else {
                  console.log("[v0] Delete user: Error -", result.error)
                  toast({
                    variant: "destructive",
                    title: "Error al eliminar",
                    description: result.error || "No se pudo eliminar el usuario",
                  })
                }
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MAINTENANCE DELETE CONFIRMATION DIALOG */}
      <Dialog open={isDeleteMaintenanceDialogOpen} onOpenChange={setIsDeleteMaintenanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Está seguro de que desea eliminar este mantenimiento programado? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteMaintenanceDialogOpen(false)
                setSelectedMaintenanceToDelete(null)
              }}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDeleteMaintenance} disabled={maintenanceLoading}>
              {maintenanceLoading ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
