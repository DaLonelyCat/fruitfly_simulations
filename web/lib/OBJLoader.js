( function () {

	class OBJLoader extends THREE.Loader {

		constructor( manager ) {

			super( manager );
			this.materials = null;

		}

		load( url, onLoad, onProgress, onError ) {

			const scope = this;
			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( this.path );
			loader.setRequestHeader( this.requestHeader );
			loader.setWithCredentials( this.withCredentials );
			loader.load( url, function ( text ) {

				try {

					onLoad( scope.parse( text ) );

				} catch ( e ) {

					if ( onError ) {

						onError( e );

					} else {

						console.error( e );

					}

					scope.manager.itemError( url );

				}

			}, onProgress, onError );

		}

		setMaterials( materials ) {

			this.materials = materials;
			return this;

		}

		parse( text ) {

			const state = {
				objects: [],
				currentObject: null,
				materialLibraries: [],
				vertices: [],
				normals: [],
				colors: [],
				uvs: [],
				materials: {}
			};

			function startObject( name, fromDeclaration ) {

				if ( state.currentObject && state.currentObject.fromDeclaration === false ) {

					state.currentObject.name = name;
					state.currentObject.fromDeclaration = ( fromDeclaration !== false );
					return;

				}

				const previousMaterial = ( state.currentObject && typeof state.currentObject.currentMaterial === 'function' ? state.currentObject.currentMaterial() : undefined );

				if ( state.currentObject && typeof state.currentObject._finalize === 'function' ) {

					state.currentObject._finalize( true );

				}

				state.currentObject = {
					name: name || '',
					fromDeclaration: ( fromDeclaration !== false ),
					geometry: {
						vertices: [],
						normals: [],
						colors: [],
						uvs: []
					},
					materials: [],
					currentMaterial: function () {

						if ( this.materials.length > 0 ) {

							return this.materials[ this.materials.length - 1 ];

						}

						return undefined;

					},
					_finalize: function ( end ) {

						const lastMultiMaterial = this.currentMaterial();
						if ( lastMultiMaterial && lastMultiMaterial.groupEnd === - 1 ) {

							lastMultiMaterial.groupEnd = this.geometry.vertices.length / 3;
							lastMultiMaterial.groupCount = lastMultiMaterial.groupEnd - lastMultiMaterial.groupStart;
							lastMultiMaterial.inherited = false;

						}

						// Ignore objects with no geometry
						if ( end && this.geometry.vertices.length === 0 ) {

							const index = state.objects.indexOf( this );
							if ( index !== - 1 ) state.objects.splice( index, 1 );

						}

					}
				};

				state.objects.push( state.currentObject );

			}

			startObject( '', false );

			function addVertex( a, b, c ) {

				const src = state.vertices;
				const dst = state.currentObject.geometry.vertices;
				dst.push( src[ a + 0 ], src[ a + 1 ], src[ a + 2 ] );
				dst.push( src[ b + 0 ], src[ b + 1 ], src[ b + 2 ] );
				dst.push( src[ c + 0 ], src[ c + 1 ], src[ c + 2 ] );

			}

			function addNormal( a, b, c ) {

				const src = state.normals;
				const dst = state.currentObject.geometry.normals;
				dst.push( src[ a + 0 ], src[ a + 1 ], src[ a + 2 ] );
				dst.push( src[ b + 0 ], src[ b + 1 ], src[ b + 2 ] );
				dst.push( src[ c + 0 ], src[ c + 1 ], src[ c + 2 ] );

			}

			function addUV( a, b, c ) {

				const src = state.uvs;
				const dst = state.currentObject.geometry.uvs;
				dst.push( src[ a + 0 ], src[ a + 1 ] );
				dst.push( src[ b + 0 ], src[ b + 1 ] );
				dst.push( src[ c + 0 ], src[ c + 1 ] );

			}

			function addFace( a, b, c, ua, ub, uc, na, nb, nc ) {

				const vLen = state.vertices.length;

				let ia = parseInt( a, 10 );
				let ib = parseInt( b, 10 );
				let ic = parseInt( c, 10 );

				if ( ia < 0 ) ia += vLen / 3; else ia -= 1;
				if ( ib < 0 ) ib += vLen / 3; else ib -= 1;
				if ( ic < 0 ) ic += vLen / 3; else ic -= 1;

				addVertex( ia * 3, ib * 3, ic * 3 );

				if ( na !== undefined && na !== '' ) {

					const nLen = state.normals.length;
					let ina = parseInt( na, 10 );
					let inb = parseInt( nb, 10 );
					let inc = parseInt( nc, 10 );

					if ( ina < 0 ) ina += nLen / 3; else ina -= 1;
					if ( inb < 0 ) inb += nLen / 3; else inb -= 1;
					if ( inc < 0 ) inc += nLen / 3; else inc -= 1;

					addNormal( ina * 3, inb * 3, inc * 3 );

				}

				if ( ua !== undefined && ua !== '' ) {

					const uvLen = state.uvs.length;
					let iua = parseInt( ua, 10 );
					let iub = parseInt( ub, 10 );
					let iuc = parseInt( uc, 10 );

					if ( iua < 0 ) iua += uvLen / 2; else iua -= 1;
					if ( iub < 0 ) iub += uvLen / 2; else iub -= 1;
					if ( iuc < 0 ) iuc += uvLen / 2; else iuc -= 1;

					addUV( iua * 2, iub * 2, iuc * 2 );

				}

			}

			const lines = text.split( '\n' );

			for ( let i = 0; i < lines.length; i ++ ) {

				let line = lines[ i ].trim();
				if ( line.length === 0 || line.charAt( 0 ) === '#' ) continue;

				const lineFirstChar = line.charAt( 0 );

				if ( lineFirstChar === 'v' ) {

					const data = line.split( /\s+/ );

					switch ( data[ 0 ] ) {

						case 'v':
							state.vertices.push( parseFloat( data[ 1 ] ), parseFloat( data[ 2 ] ), parseFloat( data[ 3 ] ) );
							break;
						case 'vn':
							state.normals.push( parseFloat( data[ 1 ] ), parseFloat( data[ 2 ] ), parseFloat( data[ 3 ] ) );
							break;
						case 'vt':
							state.uvs.push( parseFloat( data[ 1 ] ), parseFloat( data[ 2 ] ) );
							break;

					}

				} else if ( lineFirstChar === 'f' ) {

					const lineData = line.substr( 1 ).trim();
					const vertexData = lineData.split( /\s+/ );
					const faceVertices = [];

					for ( let j = 0; j < vertexData.length; j ++ ) {

						const vertex = vertexData[ j ];
						if ( vertex.length > 0 ) {

							const vertexParts = vertex.split( '/' );
							faceVertices.push( vertexParts );

						}

					}

					// Triangulate polygons
					const v1 = faceVertices[ 0 ];
					for ( let j = 1; j < faceVertices.length - 1; j ++ ) {

						const v2 = faceVertices[ j ];
						const v3 = faceVertices[ j + 1 ];
						addFace( v1[ 0 ], v2[ 0 ], v3[ 0 ], v1[ 1 ], v2[ 1 ], v3[ 1 ], v1[ 2 ], v2[ 2 ], v3[ 2 ] );

					}

				} else if ( lineFirstChar === 'g' || lineFirstChar === 'o' ) {

					const name = line.substring( 1 ).trim();
					startObject( name, true );

				}

			}

			if ( state.currentObject && typeof state.currentObject._finalize === 'function' ) {

				state.currentObject._finalize( true );

			}

			const container = new THREE.Group();

			for ( let i = 0; i < state.objects.length; i ++ ) {

				const object = state.objects[ i ];
				const geometry = object.geometry;

				if ( geometry.vertices.length === 0 ) continue;

				const buffergeometry = new THREE.BufferGeometry();
				buffergeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( geometry.vertices, 3 ) );

				if ( geometry.normals.length > 0 ) {

					buffergeometry.setAttribute( 'normal', new THREE.Float32BufferAttribute( geometry.normals, 3 ) );

				} else {

					buffergeometry.computeVertexNormals();

				}

				if ( geometry.uvs.length > 0 ) {

					buffergeometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( geometry.uvs, 2 ) );

				}

				const material = new THREE.MeshStandardMaterial( {
					color: 0xca8a04,
					roughness: 0.55,
					metalness: 0.2
				} );

				const mesh = new THREE.Mesh( buffergeometry, material );
				mesh.name = object.name;
				container.add( mesh );

			}

			return container;

		}

	}

	THREE.OBJLoader = OBJLoader;

} )();
