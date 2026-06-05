import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

// GET - Obtener equipo por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request)
    const { id } = await params
    
    const equipo = await prisma.equipo.findUnique({
      where: { id: parseInt(id) },
      include: {
        ordenesTrabajo: {
          orderBy: { created_at: 'desc' },
          take: 10,
        },
        mantenimientos: {
          where: { activo: true },
          orderBy: { proxima_programada: 'asc' },
        },
        documentos: {
          where: { estado: 'activo' },
          orderBy: { created_at: 'desc' },
        },
        mantenimientosRealizados: {
          orderBy: { fecha_realizacion: 'desc' },
          take: 5,
        },
      },
    })
    
    if (!equipo) {
      return NextResponse.json(
        { error: 'Equipo no encontrado' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(equipo)
  } catch (error: any) {
    console.error('[v0] Error fetching equipo:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener equipo' },
      { status: error.message === 'No autorizado' ? 401 : 500 }
    )
  }
}

// PUT - Actualizar equipo
const updateEquipoSchema = z.object({
  codigo: z.string().optional(),
  nombre: z.string().optional(),
  tipo: z.string().optional(),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  numero_serie: z.string().optional(),
  ubicacion: z.string().optional(),
  fecha_adquisicion: z.string().optional(),
  vida_util_anos: z.number().optional(),
  valor_adquisicion: z.number().optional(),
  estado: z.string().optional(),
  criticidad: z.string().optional(),
  descripcion: z.string().optional(),
  especificaciones: z.any().optional(),
  horas_operacion: z.number().optional(),
  ultima_mantencion: z.string().optional(),
  proxima_mantencion: z.string().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request)
    const { id } = await params
    const body = await request.json()
    
    const validation = updateEquipoSchema.safeParse(body)
    if (!validation.success) {
      const firstError = validation.error.errors?.[0]?.message || 'Validación fallida'
      return NextResponse.json(
        { error: firstError },
        { status: 400 }
      )
    }
    
    const data = validation.data
    
    // Verificar que existe
    const existente = await prisma.equipo.findUnique({
      where: { id: parseInt(id) },
    })
    
    if (!existente) {
      return NextResponse.json(
        { error: 'Equipo no encontrado' },
        { status: 404 }
      )
    }
    
    // Si cambia el código, verificar que no esté en uso
    if (data.codigo && data.codigo !== existente.codigo) {
      const codigoEnUso = await prisma.equipo.findUnique({
        where: { codigo: data.codigo },
      })
      
      if (codigoEnUso) {
        return NextResponse.json(
          { error: 'Ya existe un equipo con ese código' },
          { status: 400 }
        )
      }
    }
    
    const equipo = await prisma.equipo.update({
      where: { id: parseInt(id) },
      data: {
        ...data,
        fecha_adquisicion: data.fecha_adquisicion 
          ? new Date(data.fecha_adquisicion) 
          : undefined,
        ultima_mantencion: data.ultima_mantencion 
          ? new Date(data.ultima_mantencion) 
          : undefined,
        proxima_mantencion: data.proxima_mantencion 
          ? new Date(data.proxima_mantencion) 
          : undefined,
      },
    })
    
    // Crear log
    await prisma.log.create({
      data: {
        usuario_id: session.id,
        accion: 'Editar',
        modulo: 'Equipos',
        descripcion: `Equipo actualizado: ${equipo.nombre} (Código: ${equipo.codigo})`,
        datos: { equipo_id: equipo.id },
      },
    })
    
    return NextResponse.json(equipo)
  } catch (error: any) {
    console.error('[v0] Error updating equipo:', error)
    return NextResponse.json(
      { error: error.message || 'Error al actualizar equipo' },
      { status: error.message === 'No autorizado' ? 401 : 500 }
    )
  }
}

// DELETE - Eliminar equipo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request)
    const { id } = await params
    
    const equipo = await prisma.equipo.findUnique({
      where: { id: parseInt(id) },
    })
    
    if (!equipo) {
      return NextResponse.json(
        { error: 'Equipo no encontrado' },
        { status: 404 }
      )
    }
    
    await prisma.equipo.delete({
      where: { id: parseInt(id) },
    })
    
    // Crear log
    await prisma.log.create({
      data: {
        usuario_id: session.id,
        accion: 'Eliminar',
        modulo: 'Equipos',
        descripcion: `Equipo eliminado: ${equipo.nombre} (Código: ${equipo.codigo})`,
        datos: { equipo_id: equipo.id },
      },
    })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[v0] Error deleting equipo:', error)
    return NextResponse.json(
      { error: error.message || 'Error al eliminar equipo' },
      { status: error.message === 'No autorizado' ? 401 : 500 }
    )
  }
}
