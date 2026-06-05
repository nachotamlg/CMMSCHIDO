import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

// GET - Obtener documentos de un equipo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request)
    const { id } = await params
    const equipoId = parseInt(id)

    const documentos = await prisma.documento.findMany({
      where: { id_equipo: equipoId },
      orderBy: { created_at: 'desc' },
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(documentos)
  } catch (error: any) {
    console.error('[v0] Error fetching documentos:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener documentos' },
      { status: error.message === 'No autorizado' ? 401 : 500 }
    )
  }
}

// POST - Subir un nuevo documento
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.error('[v0] POST /documentos - === STARTING DOCUMENT UPLOAD ===')
    
    const session = await requireAuth(request)
    console.error('[v0] POST /documentos - Auth successful for user:', session.id, session.email)
    
    const { id } = await params
    const equipoId = parseInt(id)
    console.error('[v0] POST /documentos - Equipment ID:', equipoId)

    // Verificar que el equipo existe
    const equipo = await prisma.equipo.findUnique({
      where: { id: equipoId },
    })

    if (!equipo) {
      console.error('[v0] POST /documentos - Equipment not found:', equipoId)
      return NextResponse.json(
        { error: 'Equipo no encontrado' },
        { status: 404 }
      )
    }

    console.error('[v0] POST /documentos - Equipment found:', equipo.nombre)

    // Obtener el FormData
    const formData = await request.formData()
    const archivo = formData.get('archivo') as File
    const subidoPorId = formData.get('subido_por_id') as string

    console.error('[v0] POST /documentos - FormData entries:')
    for (const [key, value] of formData.entries()) {
      if (key === 'archivo' && value instanceof File) {
        console.error(`  - ${key}: File(${value.name}, ${value.size} bytes)`)
      } else {
        console.error(`  - ${key}: ${value}`)
      }
    }

    if (!archivo) {
      console.error('[v0] POST /documentos - Error: No file provided')
      return NextResponse.json(
        { error: 'No se proporciono archivo' },
        { status: 400 }
      )
    }

    if (!subidoPorId) {
      console.error('[v0] POST /documentos - Error: No subidoPorId provided')
      return NextResponse.json(
        { error: 'No se proporciono el ID del usuario que sube' },
        { status: 400 }
      )
    }

    console.error('[v0] POST /documentos - File validation passed:', archivo.name, archivo.size)

    // Validar que el archivo no sea muy grande (máximo 50MB)
    const maxSize = 50 * 1024 * 1024
    if (archivo.size > maxSize) {
      console.error('[v0] POST /documentos - File too large:', archivo.size)
      return NextResponse.json(
        { error: 'El archivo es demasiado grande. Máximo 50MB' },
        { status: 400 }
      )
    }

    // Leer contenido del archivo
    const bytes = await archivo.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Determinar tipo de documento basado en extensión
    const obtenerTipoDocumento = (nombreArchivo: string): string => {
      const ext = nombreArchivo.split('.').pop()?.toLowerCase() || '';
      if (ext === 'pdf') return 'manual';
      if (['xls', 'xlsx', 'csv'].includes(ext)) return 'especificaciones';
      if (['doc', 'docx', 'txt'].includes(ext)) return 'certificado';
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'garantia';
      return 'otro';
    };

    const tipoDocumento = obtenerTipoDocumento(archivo.name);

    // Crear documento en la base de datos con contenido
    console.error('[v0] POST /documentos - Creating document in database...')
    const documento = await prisma.documento.create({
      data: {
        nombre: archivo.name,
        tipo: tipoDocumento,
        descripcion: formData.get('descripcion') as string || undefined,
        contenido_archivo: buffer,
        tipo_archivo: archivo.type,
        tamano: archivo.size,
        id_equipo: equipoId,
        subido_por: parseInt(subidoPorId),
        almacenado_en_bd: true,
        estado: 'activo',
      },
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            email: true,
          },
        },
      },
    })

    console.error('[v0] POST /documentos - Document created successfully:', documento.id, documento.nombre)

    // Registrar auditoría de documento
    await prisma.auditoriaDocumento.create({
      data: {
        documento_id: documento.id,
        usuario_id: session.id,
        accion: 'subida',
        descripcion: `Documento "${archivo.name}" subido para equipo ${equipo.nombre}`,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || undefined,
      },
    })

    // Crear log
    await prisma.log.create({
      data: {
        usuario_id: session.id,
        accion: 'Subir',
        modulo: 'Documentos',
        descripcion: `Documento subido: ${archivo.name} para equipo ${equipo.nombre} (Código: ${equipo.codigo})`,
        datos: { documento_id: documento.id, equipo_id: equipoId, tipo: tipoDocumento },
      },
    })

    console.error('[v0] POST /documentos - === UPLOAD COMPLETED SUCCESSFULLY ===')
    return NextResponse.json(documento, { status: 201 })
  } catch (error: any) {
    console.error('[v0] POST /documentos - ERROR:', error)
    console.error('[v0] POST /documentos - Error message:', error.message)
    console.error('[v0] POST /documentos - Error stack:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Error al subir documento' },
      { status: error.message === 'No autorizado' ? 401 : 500 }
    )
  }
}
