import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'

// GET - Obtener documento por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request)
    
    const { id } = await params
    const documentoId = parseInt(id)
    
    if (isNaN(documentoId)) {
      return NextResponse.json(
        { error: 'ID de documento inválido' },
        { status: 400 }
      )
    }
    
    const documento = await prisma.documento.findUnique({
      where: { id: documentoId },
      include: {
        subidoPor: {
          select: {
            id: true,
            nombre: true,
            email: true,
          },
        },
        equipo: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
          },
        },
      },
    })
    
    if (!documento) {
      return NextResponse.json(
        { error: 'Documento no encontrado' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(documento)
  } catch (error: any) {
    console.error('[v0] Error fetching documento:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener documento' },
      { status: error.message === 'No autorizado' ? 401 : 500 }
    )
  }
}

// DELETE - Eliminar (soft delete) documento
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('[v0] DELETE /documentos/[id] - Starting delete process')
    const session = await requireAuth(request)
    console.log('[v0] DELETE /documentos/[id] - Auth passed, userId:', session.id)
    
    const { id } = await params
    const documentoId = parseInt(id)
    
    if (isNaN(documentoId)) {
      console.log('[v0] DELETE /documentos/[id] - Invalid ID:', id)
      return NextResponse.json(
        { error: 'ID de documento inválido' },
        { status: 400 }
      )
    }
    
    console.log('[v0] DELETE /documentos/[id] - Looking for document:', documentoId)
    const documento = await prisma.documento.findUnique({
      where: { id: documentoId },
    })
    
    if (!documento) {
      console.log('[v0] DELETE /documentos/[id] - Document not found:', documentoId)
      return NextResponse.json(
        { error: 'Documento no encontrado' },
        { status: 404 }
      )
    }
    
    console.log('[v0] DELETE /documentos/[id] - Document found, updating estado to eliminado')
    // Soft delete: marcar como eliminado en lugar de borrar completamente
    const documentoActualizado = await prisma.documento.update({
      where: { id: documentoId },
      data: {
        estado: 'eliminado',
        updated_at: new Date(),
      },
    })
    
    console.log('[v0] DELETE /documentos/[id] - Document updated successfully:', documentoActualizado)
    
    // Registrar auditoría
    await prisma.auditoriaDocumento.create({
      data: {
        documento_id: documentoId,
        usuario_id: session.id,
        accion: 'eliminacion',
        descripcion: `Documento "${documento.nombre}" marcado como eliminado`,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || undefined,
      },
    }).catch(err => console.error('[v0] Error registering audit:', err))
    
    // Create audit log
    await prisma.log.create({
      data: {
        usuario_id: session.id,
        accion: 'ELIMINAR',
        modulo: 'DOCUMENTOS',
        descripcion: `Documento eliminado: ${documento.nombre}`,
        datos: { documento_id: documentoId, nombre: documento.nombre },
      },
    }).catch(err => console.error('[v0] Error creating audit log:', err))
    
    console.log('[v0] DELETE /documentos/[id] - Document soft deleted successfully:', documentoId)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Documento eliminado correctamente',
      documento: documentoActualizado 
    })
  } catch (error: any) {
    console.error('[v0] Error deleting documento:', error)
    console.error('[v0] Error stack:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Error al eliminar documento' },
      { status: error.message === 'No autorizado' ? 401 : 500 }
    )
  }
}
