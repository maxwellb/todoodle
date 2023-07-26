import { track, useQuickReactor, useStateTracking } from '@tldraw/state'
import { TLShape, TLShapeId } from '@tldraw/tlschema'
import * as React from 'react'
import { ShapeUtil } from '../editor/shapes/ShapeUtil'
import { useEditor } from '../hooks/useEditor'
import { useEditorComponents } from '../hooks/useEditorComponents'
import { Matrix2d } from '../primitives/Matrix2d'
import { OptionalErrorBoundary } from './ErrorBoundary'

/*
This component renders shapes on the canvas. There are two stages: positioning
and styling the shape's container using CSS, and then rendering the shape's 
JSX using its shape util's render method. Rendering the "inside" of a shape is
more expensive than positioning it or changing its color, so we use React.memo
to wrap the inner shape and only re-render it when the shape's props change. 

The shape also receives props for its index and opacity. The index is used to
determine the z-index of the shape, and the opacity is used to set the shape's
opacity based on its own opacity and that of its parent's.
*/
export const Shape = track(function Shape({
	id,
	shape,
	util,
	index,
	backgroundIndex,
	opacity,
	isCulled,
}: {
	id: TLShapeId
	shape: TLShape
	util: ShapeUtil
	index: number
	backgroundIndex: number
	opacity: number
	isCulled: boolean
}) {
	const editor = useEditor()

	const { ShapeErrorFallback } = useEditorComponents()

	const containerRef = React.useRef<HTMLDivElement>(null)
	const backgroundContainerRef = React.useRef<HTMLDivElement>(null)

	const setProperty = React.useCallback((property: string, value: string) => {
		containerRef.current?.style.setProperty(property, value)
		backgroundContainerRef.current?.style.setProperty(property, value)
	}, [])

	useQuickReactor(
		'set shape container transform position',
		() => {
			const shape = editor.getShape(id)
			if (!shape) return // probably the shape was just deleted

			const pageTransform = editor.getPageTransform(id)
			const transform = Matrix2d.toCssString(pageTransform)
			setProperty('transform', transform)
		},
		[editor, setProperty]
	)

	useQuickReactor(
		'set shape container clip path',
		() => {
			const shape = editor.getShape(id)
			if (!shape) return null

			const clipPath = editor.getClipPath(id)
			setProperty('clip-path', clipPath ?? 'none')
		},
		[editor, setProperty]
	)

	useQuickReactor(
		'set shape height and width',
		() => {
			const shape = editor.getShape(id)
			if (!shape) return null

			const bounds = editor.getGeometry(shape).bounds
			setProperty('width', Math.max(1, Math.ceil(bounds.width)) + 'px')
			setProperty('height', Math.max(1, Math.ceil(bounds.height)) + 'px')
		},
		[editor]
	)

	// Set the opacity of the container when the opacity changes
	React.useLayoutEffect(() => {
		setProperty('opacity', opacity + '')
		containerRef.current?.style.setProperty('z-index', index + '')
		backgroundContainerRef.current?.style.setProperty('z-index', backgroundIndex + '')
	}, [opacity, index, backgroundIndex, setProperty])

	// const shape = editor.getShape(id)

	const annotateError = React.useCallback(
		(error: any) => {
			editor.annotateError(error, { origin: 'react.shape', willCrashApp: false })
		},
		[editor]
	)

	if (!shape) return null

	return (
		<>
			{util.backgroundComponent && (
				<div
					ref={backgroundContainerRef}
					className="tl-shape tl-shape-background"
					data-shape-type={shape.type}
					draggable={false}
				>
					{!isCulled && (
						<OptionalErrorBoundary fallback={ShapeErrorFallback} onError={annotateError}>
							<InnerShapeBackground shape={shape} util={util} />
						</OptionalErrorBoundary>
					)}
				</div>
			)}
			<div ref={containerRef} className="tl-shape" data-shape-type={shape.type} draggable={false}>
				{isCulled && util.canUnmount(shape) ? (
					<CulledShape shape={shape} />
				) : (
					<OptionalErrorBoundary fallback={ShapeErrorFallback as any} onError={annotateError}>
						<InnerShape shape={shape} util={util} />
					</OptionalErrorBoundary>
				)}
			</div>
		</>
	)
})

const InnerShape = React.memo(
	function InnerShape<T extends TLShape>({ shape, util }: { shape: T; util: ShapeUtil<T> }) {
		return useStateTracking('InnerShape:' + shape.type, () => util.component(shape))
	},
	(prev, next) => prev.shape.props === next.shape.props && prev.shape.meta === next.shape.meta
)

const InnerShapeBackground = React.memo(
	function InnerShapeBackground<T extends TLShape>({
		shape,
		util,
	}: {
		shape: T
		util: ShapeUtil<T>
	}) {
		return useStateTracking('InnerShape:' + shape.type, () => util.backgroundComponent?.(shape))
	},
	(prev, next) => prev.shape.props === next.shape.props && prev.shape.meta === next.shape.meta
)

const CulledShape = React.memo(
	function CulledShape<T extends TLShape>({ shape }: { shape: T }) {
		const editor = useEditor()
		const bounds = editor.getGeometry(shape).bounds

		return (
			<div
				className="tl-shape__culled"
				style={{
					transform: `translate(${bounds.minX}px, ${bounds.minY}px)`,
					width: Math.max(1, bounds.width),
					height: Math.max(1, bounds.height),
				}}
			/>
		)
	},
	() => true
)