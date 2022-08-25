/*
 Copyright 2022 Esri

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import AppBase from "./support/AppBase.js";
import AppLoader from "./loaders/AppLoader.js";
import SignIn from './apl/SignIn.js';
import SlidesList from './apl/SlidesList.js';
import ImageryTileData from './ImageryTileData.js';

class Application extends AppBase {

  // PORTAL //
  portal;

  // COLORS //
  WOODWELL_COLORS = {red: '#fa3817', white: '#ffffff', blue: '#439bff', location: '#00ff00'};

  constructor() {
    super();

    // LOAD APPLICATION BASE //
    super.load().then(() => {

      // APPLICATION LOADER //
      const applicationLoader = new AppLoader({app: this, viewConfig: this.viewConfig});
      applicationLoader.load().then(({portal, group, map, view}) => {
        //console.info(portal, group, map, view);

        // PORTAL //
        this.portal = portal;

        // USER SIGN-IN //
        //this.configUserSignIn();

        // SET APPLICATION DETAILS //
        this.setApplicationDetails({map, group});

        // APPLICATION //
        window.document.body.style.cursor = 'wait';
        view?.container.classList.add('view-no-interaction');
        this.applicationReady({portal, group, map, view}).catch(this.displayError).then(() => {
          // HIDE APP LOADER //
          document.getElementById('app-loader').removeAttribute('active');
          view?.container.classList.remove('view-no-interaction');
          window.document.body.style.cursor = 'default';
        });

      }).catch(this.displayError);
    }).catch(this.displayError);

  }

  /**
   *
   */
  configUserSignIn() {

    const signInContainer = document.getElementById('sign-in-container');
    if (signInContainer) {
      const signIn = new SignIn({container: signInContainer, portal: this.portal});
    }

  }

  /**
   *
   * @param view
   */
  configView(view) {
    return new Promise((resolve, reject) => {
      if (view) {
        require([
          'esri/core/reactiveUtils',
          'esri/widgets/Home',
          'esri/widgets/Legend'
        ], (reactiveUtils, Home, Legend) => {

          //
          // CONFIGURE VIEW SPECIFIC STUFF HERE //
          //
          view.set({
            environment: {
              background: {
                type: "color",
                color: [0, 0, 0, 0]
              },
              lighting: {type: 'virtual'},
              starsEnabled: false,
              atmosphereEnabled: false
            },
            constraints: {snapToZoom: false},
            popup: {
              dockEnabled: true,
              dockOptions: {
                buttonEnabled: false,
                breakpoint: false,
                position: "top-center"
              }
            }
          });

          // HOME //
          const home = new Home({view});
          view.ui.add(home, {position: 'top-right', index: 0});

          // LEGEND //
          /*
           const legend = new Legend({ view: view });
           view.ui.add(legend, {position: 'bottom-left', index: 0});
           */

          // VIEW UPDATING //
          this.disableViewUpdating = false;
          const viewUpdating = document.getElementById('view-updating');
          view.ui.add(viewUpdating, 'bottom-right');
          reactiveUtils.watch(() => view.updating, (updating) => {
            (!this.disableViewUpdating) && viewUpdating.toggleAttribute('active', updating);
          });

          resolve();
        });
      } else { resolve(); }
    });
  }

  /**
   *
   * @param portal
   * @param group
   * @param map
   * @param view
   * @returns {Promise}
   */
  applicationReady({portal, group, map, view}) {
    return new Promise(async (resolve, reject) => {

      // VIEW READY //
      this.configView(view).then(() => {
        this.initializeTrendCharts();
        this.initializeCountriesLayer({view});
        this.initializeNorthPole({view});
        //this.initializeArcticBorealZone({view});
        this.initializeTrendLayers({view}).then(({tempMeansTrendsLayer, frozenDaysTrendLayer}) => {
          this.initializeTrendOptions({view, tempMeansTrendsLayer, frozenDaysTrendLayer});
          this.initializeAnalysisLocation({view, tempMeansTrendsLayer, frozenDaysTrendLayer});
          this.initializeIntroSlide({view}).then(resolve).catch(reject);
        }).catch(reject);
      }).catch(reject);
    });
  }

  /**
   *
   * @param view
   */
  initializeIntroSlide({view}) {
    return new Promise((resolve, reject) => {
      require([
        "esri/core/reactiveUtils",
        "esri/widgets/Expand"
      ], (reactiveUtils, Expand) => {

        // SLIDES LIST //
        const slidesList = new SlidesList({view: view, displayThumbnails: true});

        // SLIDES EXPAND //
        const slidesExpand = new Expand({
          view: view,
          content: slidesList,
          expandIconClass: "esri-icon-applications",
          expandTooltip: "Places of Interest"
        });
        view.ui.add(slidesExpand, {position: "top-right", index: 1});

        // INITIAL INTRO SLIDE //
        slidesList.addEventListener('slides-ready', () => {
          slidesList.goToSlide('North Pole', {duration: 5000}).then(resolve).catch(reject);
        });

      });
    });
  }

  /**
   *
   * @param view
   */
  initializeNorthPole({view}) {
    require([
      "esri/Graphic",
      "esri/layers/GraphicsLayer",
      "esri/geometry/Point",
      "esri/geometry/geometryEngine"
    ], (Graphic, GraphicsLayer, Point, geometryEngine) => {

      // NORTH POLE //
      const northPole = new Point([180.0, 90.0]);
      // NORTH POLE AREA //
      const northPoleAreaGraphic = new Graphic({
        geometry: geometryEngine.geodesicBuffer(northPole, 560, 'kilometers'),
        symbol: {
          type: 'simple-fill',
          color: 'rgba(204,234,251,0.85)',
          outline: {color: 'rgba(151,180,203,0.45)', width: 1.0}
        }
      });
      const northPoleLabelGraphic = new Graphic({
        geometry: {type: 'point', x: 180.0, y: 90.0},
        symbol: {
          type: "point-3d",
          symbolLayers: [{
            type: "text",
            text: `north pole`,
            verticalAlignment: 'bottom',
            horizontalAlignment: 'center',
            size: 11.0,
            font: {family: 'Avenir Next LT Pro', weight: "normal"},
            material: {color: this.WOODWELL_COLORS.red}, // #242424
            background: {color: 'rgba(255,255,255,0.2)'}
          }]
        }
      });
      const northPoleLayer = new GraphicsLayer({
        graphics: [northPoleAreaGraphic, northPoleLabelGraphic]
      });
      view.map.add(northPoleLayer, 10);

    });
  }

  /**
   *
   * @param view
   */
  initializeCountriesLayer({view}) {

    const countriesLabelLayer = view.map.allLayers.find(layer => { return (layer.title === "World Country Labels"); });
    countriesLabelLayer.load().then(() => {

      const labelsAction = document.getElementById('labels-action');
      labelsAction.addEventListener('click', () => {
        countriesLabelLayer.visible = labelsAction.toggleAttribute('active');
      });

    });

  }

  /**
   *
   * @param view
   */

  /*initializeArcticBorealZone({view}) {
   require(["esri/core/reactiveUtils"], (reactiveUtils) => {
   const transitionZoomLevel = 5.5;

   const abzGeneralizedLayer = view.map.allLayers.find(layer => { return (layer.title === "Arctic Boreal Zone - (generalized)"); });
   const abzDetailedLayer = view.map.allLayers.find(layer => { return (layer.title === "Arctic Boreal Zone - (detailed)"); });

   Promise.all([abzGeneralizedLayer.load(), abzDetailedLayer.load()]).then(() => {
   reactiveUtils.watch(() => view.zoom, zoom => {
   if (zoom < transitionZoomLevel) {
   !abzGeneralizedLayer.visible && (abzGeneralizedLayer.visible = true);
   } else {
   !abzDetailedLayer.visible && (abzDetailedLayer.visible = true);
   }
   });

   });
   });
   }*/

  /**
   *
   * https://developers.arcgis.com/javascript/latest/api-reference/esri-renderers-RasterStretchRenderer.html
   *
   * @param {SceneView} view
   * @returns {Promise<{tempMeansTrendsLayer: ImageryTileLayer, frozenDaysTrendLayer:ImageryTileLayer}>}
   */
  initializeTrendLayers({view}) {
    return new Promise((resolve, reject) => {

      const tempMeansTrendsLayer = view.map.allLayers.find(layer => { return (layer.title === "Temp Means Trends"); });
      const frozenDaysTrendLayer = view.map.allLayers.find(layer => { return (layer.title === "Frozen Days Trends"); });

      Promise.all([
        tempMeansTrendsLayer.load(),
        frozenDaysTrendLayer.load()
      ]).then(([]) => {

        // UPDATE TREND LAYERS AND SAVE RENDERING IN WEB SCENE //
        const updateTrendLayerRendering = () => {

          const blendMode = 'multiply';

          tempMeansTrendsLayer.set({
            bandId: 2,
            interpolation: 'bilinear',
            blendMode: blendMode,
            opacity: 1.0,
            renderingRule: null,
            renderer: {
              type: 'raster-stretch',
              stretchType: 'min-max',
              statistics: [{
                min: -0.04,
                max: 0.04,
                avg: -0.24971247235947172,
                stddev: 0.37222849013071047
              }],
              colorRamp: {
                type: 'multipart',
                colorRamps: [
                  {algorithm: 'hsv', fromColor: this.WOODWELL_COLORS.blue, toColor: this.WOODWELL_COLORS.white},
                  {algorithm: 'hsv', fromColor: this.WOODWELL_COLORS.white, toColor: this.WOODWELL_COLORS.red}
                ]
              }
            }
          });

          frozenDaysTrendLayer.set({
            bandId: 2,
            interpolation: 'bilinear',
            blendMode: blendMode,
            opacity: 1.0,
            renderingRule: null,
            renderer: {
              type: 'raster-stretch',
              stretchType: 'min-max',
              statistics: [{
                min: -0.2,
                max: 0.2,
                avg: -0.24971247235947172,
                stddev: 0.37222849013071047
              }],
              colorRamp: {
                type: 'multipart',
                colorRamps: [
                  {algorithm: 'hsv', fromColor: this.WOODWELL_COLORS.red, toColor: this.WOODWELL_COLORS.white},
                  {algorithm: 'hsv', fromColor: this.WOODWELL_COLORS.white, toColor: this.WOODWELL_COLORS.blue}
                ]
              }
            }
          });

          // SAVE WEB SCENE //
          if (confirm("Are you sure you want to update the trend layer renderers in the Web Scene?")) {
            view.map.updateFrom(view, {environmentExcluded: true}).then(() => {
              view.map.save({ignoreUnsupported: true});
            }).catch(error => {
              this.displayError(error);
            });
          }

        };

        // ENABLE ABILITY TO SAVE THE WEB SCENE //
        if (this.saveMap === 'true') {
          const mapSaveAction = document.getElementById('map-save-action');
          mapSaveAction.toggleAttribute('hidden', false);
          mapSaveAction.addEventListener('click', () => {

            /**
             * NOTE: APPLY RENDERERS DYNAMICALLY AND ENABLE THE
             *       ABILITY TO SAVE/UPDATE THE WEB SCENE WITH
             *       THESE NEW LAYER RENDERER SETTINGS.
             */
            updateTrendLayerRendering();
          });

        }

        resolve({tempMeansTrendsLayer, frozenDaysTrendLayer});
      }).catch(reject);
    });

  }

  /**
   *
   * @param {SceneView} view
   * @param {ImageryTileLayer} tempMeansTrendsLayer
   * @param {ImageryTileLayer} frozenDaysTrendLayer
   */
  initializeTrendOptions({view, tempMeansTrendsLayer, frozenDaysTrendLayer}) {
    require(["esri/core/reactiveUtils"], (reactiveUtils) => {

      const tempMeansBlock = document.getElementById('temp-means-block');
      const frozenDaysBlock = document.getElementById('frozen-days-block');

      const MAX_FROZEN_DAYS_DURATION = 40;

      let _duration = MAX_FROZEN_DAYS_DURATION;
      this.getDuration = () => { return _duration; };

      const setDuration = duration => {
        _duration = duration;

        tempMeansTrendsLayer.multidimensionalDefinition = [{
          variableName: 'Temperature Means Trends',
          dimensionName: 'Duration',
          values: [_duration],
          isSlice: true
        }];

        frozenDaysTrendLayer.multidimensionalDefinition = [{
          variableName: 'Frozen Days Trends',
          dimensionName: 'Duration',
          values: [_duration],
          isSlice: true
        }];

        tempMeansTrendsLayer.refresh();
        frozenDaysTrendLayer.refresh();

        reactiveUtils.whenOnce(() => !view.updating).then(() => {
          this.dispatchEvent(new CustomEvent('duration-change', {detail: {duration}}));
        });

      };
      setDuration(_duration);

      // DURATION CHANGE //
      const durationOptions = document.getElementById('duration-options');
      durationOptions.addEventListener('calciteRadioGroupChange', ({detail}) => {
        setDuration(+detail);
      });

      /**
       *
       * @param selectedLayer
       */
      const setActiveTrendLayer = selectedLayer => {
        switch (selectedLayer) {
          case 'temp-means':
            durationOptions.querySelector('calcite-radio-group-item[value="60"]').removeAttribute('disabled');
            durationOptions.querySelector('calcite-radio-group-item[value="50"]').removeAttribute('disabled');

            tempMeansTrendsLayer.visible = true;
            frozenDaysTrendLayer.visible = false;
            break;

          case 'frozen-days':
            durationOptions.querySelector('calcite-radio-group-item[value="60"]').toggleAttribute('disabled', true);
            durationOptions.querySelector('calcite-radio-group-item[value="50"]').toggleAttribute('disabled', true);

            const invalidFrozenDaysDuration = (_duration > MAX_FROZEN_DAYS_DURATION);
            invalidFrozenDaysDuration && (durationOptions.value = MAX_FROZEN_DAYS_DURATION);
            invalidFrozenDaysDuration && setDuration(MAX_FROZEN_DAYS_DURATION);

            tempMeansTrendsLayer.visible = false;
            frozenDaysTrendLayer.visible = true;
            break;
        }

        tempMeansBlock.toggleAttribute('active', (selectedLayer === 'temp-means'));
        frozenDaysBlock.toggleAttribute('active', (selectedLayer === 'frozen-days'));

      };

      // TREND LAYER VISIBILITY CHANGE //
      const layerOptions = document.getElementById('layer-options');
      layerOptions.addEventListener('calciteRadioGroupChange', ({detail}) => {
        setActiveTrendLayer(detail);
      });

      /*const tempMeansLayerToggles = document.querySelector(`.layer-toggle[layer="temp-means"]`);
       const frozenDaysLayerToggles = document.querySelector(`.layer-toggle[layer="frozen-days"]`);
       tempMeansLayerToggles.addEventListener('calciteSwitchChange', () => {
       setActiveTrendLayer(tempMeansLayerToggles.checked ? 'temp-means' : 'frozen-days');
       frozenDaysLayerToggles.checked = !tempMeansLayerToggles.checked;
       });
       frozenDaysLayerToggles.addEventListener('calciteSwitchChange', () => {
       setActiveTrendLayer(frozenDaysLayerToggles.checked ? 'frozen-days' : 'temp-means');
       tempMeansLayerToggles.checked = !frozenDaysLayerToggles.checked;
       });*/

    });
  }

  /**
   *
   * @param {MapView} view
   * @param {ImageryTileLayer} tempMeansTrendsLayer
   * @param {ImageryTileLayer} frozenDaysTrendLayer
   */
  initializeAnalysisLocation({view, tempMeansTrendsLayer, frozenDaysTrendLayer}) {
    require([
      "esri/Graphic",
      'esri/layers/GraphicsLayer',
      'esri/widgets/Search'
    ], (Graphic, GraphicsLayer, Search) => {

      const baseTextSymbol = {
        type: "text",
        verticalAlignment: 'bottom',
        horizontalAlignment: 'center',
        size: 11.0,
        font: {family: 'Avenir Next LT Pro', weight: "bold"},
        material: {color: '#242424'},
        background: {color: 'rgba(255,255,255,0.8)'}
      };
      const verticalOffset = {screenLength: 33};
      const callout = {type: "line", size: 1.5, color: this.WOODWELL_COLORS.white};

      const getLocationSymbol = (text = 'lon: xxx.x | lat: xx.x') => {
        return {
          type: "point-3d",
          verticalOffset,
          callout,
          symbolLayers: [
            {...baseTextSymbol, text}
          ]
        };
      };

      const analysisLocationGraphic = new Graphic({symbol: getLocationSymbol()});
      const analysisGraphicsLayer = new GraphicsLayer({graphics: [analysisLocationGraphic]});
      view.map.add(analysisGraphicsLayer);

      const updateLocationGraphic = () => {
        const locationLabel = _mapPoint ? `lon: ${ _mapPoint.longitude.toFixed(2) } lat: ${ _mapPoint.latitude.toFixed(2) }` : null;
        analysisLocationGraphic.set({
          geometry: _mapPoint,
          symbol: getLocationSymbol(locationLabel)
        });
      };

      //
      // INDICATOR UPDATES //
      //
      const degreeFormatter = new Intl.NumberFormat('default', {minimumFractionDigits: 2, maximumFractionDigits: 2});
      const daysFormatter = new Intl.NumberFormat('default', {minimumFractionDigits: 1, maximumFractionDigits: 1});

      // INITIALIZE TEMP MEANS TREND UPDATES //
      const initializeTempMeansTrendUpdate = () => {
        const tempMeansIndicator = document.querySelector('.temp-means-indicator');
        const abzLabel = tempMeansIndicator.querySelector('.abz-section .diff-value');
        const locationLabel = tempMeansIndicator.querySelector('.location-section .diff-value');
        return (abzTrend, locationTrend) => {
          abzLabel.innerHTML = abzTrend ? `${ degreeFormatter.format(abzTrend) }&deg;` : '--';
          locationLabel.innerHTML = locationTrend ? `${ degreeFormatter.format(locationTrend) }&deg;` : '--';
        };
      };

      // INITIALIZE FROZEN DAYS TREND UPDATES //
      const initializeFrozenDaysTrendUpdate = () => {
        const frozenDaysIndicator = document.querySelector('.frozen-days-indicator');
        const abzLabel = frozenDaysIndicator.querySelector('.abz-section .diff-value');
        const locationLabel = frozenDaysIndicator.querySelector('.location-section .diff-value');
        return (abzTrend, locationTrend) => {
          abzLabel.innerHTML = abzTrend ? daysFormatter.format(abzTrend) : '--';
          locationLabel.innerHTML = locationTrend ? daysFormatter.format(locationTrend) : '--';
        };
      };

      // TREND UPDATES //
      const setTempMeansTrend = initializeTempMeansTrendUpdate();
      const setFrozenDaysTrend = initializeFrozenDaysTrendUpdate();

      // ABZ TRENDS //
      const arcticBorealZoneTrends = this.arcticThaw.arcticBorealZoneTrends;

      // SET TREND INDICATOR //
      const setTrendIndicator = (indicator, getDataResults) => {
        //console.info(getDataResults);

        const abzTrend = getDataResults ? arcticBorealZoneTrends[indicator][getDataResults.startYear] : null;
        const locationTrend = getDataResults?.slope;

        switch (indicator) {
          case 'temp-means':
            setTempMeansTrend(abzTrend, locationTrend);
            break;
          case 'frozen-days':
            setFrozenDaysTrend(abzTrend, locationTrend);
            break;
        }
      };

      let _duration = this.getDuration();
      this.addEventListener('duration-change', ({detail: {duration}}) => {
        _duration = duration;
        updateLocationTrendAnalysis();
      });

      // COORDINATES //
      const analysisLocationCoordinatesInput = document.getElementById('analysis-location-coordinates-input');

      // ANALYSIS LOCATION //
      let _mapPoint = null;
      this.setAnalysisLocation = ({mapPoint}) => {
        _mapPoint = mapPoint;
        analysisLocationCoordinatesInput.value = `Longitude: ${ _mapPoint.longitude.toFixed(4) } Latitude: ${ _mapPoint.latitude.toFixed(4) }`;
        updateLocationGraphic();
        updateLocationTrendAnalysis();
        this.dispatchEvent(new CustomEvent('location-change', {detail: {location: _mapPoint}}));
      };
      this.clearAnalysisLocation = () => {
        _mapPoint = null;
        analysisLocationCoordinatesInput.value = null;
        updateLocationGraphic();
        updateLocationTrendAnalysis();
        enableMapSearch(false);
        this.clearSearchTerm();
        this.dispatchEvent(new CustomEvent('location-change', {detail: {location: _mapPoint}}));
      };

      const tempMeansData = new ImageryTileData({
        layer: tempMeansTrendsLayer,
        variableName: 'Temperature Means Trends',
        dimensionName: 'Duration',
        durations: [60, 50, 40, 30, 20]
      });
      const frozenDaysData = new ImageryTileData({
        layer: frozenDaysTrendLayer,
        variableName: 'Frozen Days Trends',
        dimensionName: 'Duration',
        durations: [40, 30, 20]
      });

      // UPDATE LOCATION TREND ANALYSIS //
      const updateLocationTrendAnalysis = () => {
        if (_mapPoint) {

          tempMeansData.getData({mapPoint: _mapPoint}).then((tempMeansResults) => {
            const currentTempMeansResult = tempMeansResults.find(results => results.duration === _duration);
            setTrendIndicator('temp-means', currentTempMeansResult);
            this.dispatchEvent(new CustomEvent('temp-means-trends-change', {detail: {tempMeansTrends: tempMeansResults}}));
          });

          frozenDaysData.getData({mapPoint: _mapPoint}).then((frozenDaysResults) => {
            const currentFrozenDaysResult = frozenDaysResults.find(results => results.duration === _duration);
            setTrendIndicator('frozen-days', currentFrozenDaysResult);
            this.dispatchEvent(new CustomEvent('frozen-days-trends-change', {detail: {frozenDaysTrends: frozenDaysResults}}));
          });

        } else {
          setTrendIndicator('temp-means');
          setTrendIndicator('frozen-days');
          this.dispatchEvent(new CustomEvent('temp-means-trends-change', {detail: {tempMeansTrends: null}}));
          this.dispatchEvent(new CustomEvent('frozen-days-trends-change', {detail: {frozenDaysTrends: null}}));
        }
      };

      // USER VIEW CLICK //
      let viewClickHandle = null;
      const enableMapSearch = enabled => {
        if (enabled) {
          this.clearSearchTerm();
          viewClickHandle = view.on('click', this.setAnalysisLocation);
        } else {
          viewClickHandle && viewClickHandle.remove();
        }
        view.container.style.cursor = enabled ? 'crosshair' : 'default';
        searchLocationBtn.setAttribute('icon-end', enabled ? 'check' : 'blank');
        searchLocationBtn.setAttribute('color', enabled ? 'blue' : 'neutral');
      };

      const searchLocationBtn = document.getElementById('search-location-btn');
      searchLocationBtn.addEventListener('click', () => {
        const isActive = searchLocationBtn.toggleAttribute('active');
        enableMapSearch(isActive);
      });

      // SEARCH /
      const search = new Search({
        container: 'search-container',
        view: view,
        locationEnabled: false,
        popupEnabled: false,
        resultGraphicEnabled: false,
        allPlaceholder: "Find place",
        searchTerm: this.place || '',
        goToOverride: (view, goToParams) => {
          return view.goTo({...goToParams.target, scale: view.scale});
        }
      });
      search.on('select-result', ({result: {feature}}) => {
        this.setAnalysisLocation({mapPoint: feature.geometry});
      });
      this.clearSearchTerm = () => {
        search.searchTerm = null;
      };

      const analysisLocationCoordinatesClearBtn = document.getElementById('analysis-location-coordinates-clear-btn');
      analysisLocationCoordinatesClearBtn.addEventListener('click', () => {
        this.clearAnalysisLocation();
      });

    });
  }

  /**
   *
   */
  initializeTrendCharts() {
    require(["esri/Color"], (Color) => {

      Chart.defaults.font.family = 'Avenir Next LT Pro';

      const defaultTitle = {
        display: true, color: '#efefef', font: {weight: 'normal', size: 15}
      };

      const defaultLegend = {
        display: true, onClick: null, labels: {
          pointStyle: 'line', usePointStyle: true, color: '#efefef', filter: (item, data) => {
            return data.datasets.length;
          }
        }
      };

      const defaultGridLines = {
        color: '#666666', drawBorder: true
      };

      const defaultDataset = {
        fill: false, borderWidth: 1.5
      };

      const tempMeansTrendChartNode = document.getElementById('temp-means-trend-chart');
      const tempMeansChart = new Chart(tempMeansTrendChartNode, {
        type: 'line',
        data: {
          datasets: []
        },
        options: {
          animations: false,
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              ...defaultTitle,
              text: 'Air Temperature'
            },
            legend: defaultLegend
          },
          scales: {
            y: {
              type: "linear",
              display: true,
              title: {
                display: true,
                text: 'Temperature °C',
                color: '#efefef',
                font: {size: 11}
              },
              ticks: {
                padding: 5,
                precision: 0,
                stepSize: 1,
                color: '#efefef',
                callback: (value, index, values) => {
                  return `${ value.toFixed(1) }°`;
                }
              },
              grid: defaultGridLines
            },
            x: {
              type: 'linear',
              position: 'bottom',
              min: 1950,
              max: 2020,
              title: {
                display: true,
                text: 'Trend Duration',
                color: '#efefef',
                font: {size: 12}
              },
              ticks: {
                padding: 5,
                stepSize: 10,
                color: '#efefef',
                font: {size: 11},
                callback: (value) => {
                  return value.toFixed(0);
                }
              },
              grid: defaultGridLines
            }
          }
        }
      });

      const frozenDaysTrendChartNode = document.getElementById('frozen-days-trend-chart');
      const frozenDaysChart = new Chart(frozenDaysTrendChartNode, {
        type: 'line',
        data: {
          datasets: []
        },
        options: {
          animations: false,
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              ...defaultTitle,
              text: 'Days with Frozen Ground'
            },
            legend: defaultLegend
          },
          scales: {
            y: {
              type: "linear",
              display: true,
              title: {
                display: true,
                text: 'Frozen Days',
                color: '#efefef',
                font: {size: 11}
              },
              ticks: {
                padding: 5,
                precision: 0,
                stepSize: 30,
                color: '#efefef'
              },
              grid: defaultGridLines
            },
            x: {
              type: 'linear',
              position: 'bottom',
              title: {
                display: true,
                text: 'Trend Duration',
                color: '#efefef',
                font: {size: 12}
              },
              min: 1950,
              max: 2020,
              ticks: {
                padding: 5,
                stepSize: 10,
                color: '#efefef',
                font: {size: 11},
                callback: (value) => {
                  return value.toFixed(0);
                }
              },
              grid: defaultGridLines
            }
          }
        }
      });

      const createTrendDataset = (trendInfo, duration, decreaseColor, increaseColor) => {

        const isCurrentDuration = (trendInfo.duration === duration);
        const trendColor = new Color((trendInfo.slope > 0) ? increaseColor : decreaseColor);
        trendColor.a = isCurrentDuration ? 1.0 : 0.6;
        const borderWidth = isCurrentDuration ? 2.0 : 1.0;
        const borderColor = trendColor.toCss(true);
        const pointRadius = isCurrentDuration ? 5.0 : 2.0;
        const pointBackgroundColor = isCurrentDuration ? this.WOODWELL_COLORS.white : trendColor.toCss(true);
        const pointBorderColor = trendColor.toCss(true);

        return {
          ...defaultDataset,
          borderColor,
          borderWidth,
          pointRadius,
          pointBorderColor,
          pointBackgroundColor,
          label: `${ trendInfo.duration } yrs`,
          data: [
            {x: trendInfo.startYear, y: trendInfo.start},
            {x: trendInfo.endYear, y: trendInfo.end}
          ]
        };

      };

      this.addEventListener('temp-means-trends-change', ({detail: {tempMeansTrends}}) => {
        let duration = this.getDuration();
        if (tempMeansTrends) {
          //tempMeansChart.options.plugins.title.text = `Air Temperature - ${ duration } years`;
          tempMeansChart.data.datasets = tempMeansTrends.filter(tempMeansTrend => {
            return (tempMeansTrend.slope != null);
          }).map(tempMeansTrend => {
            return createTrendDataset(tempMeansTrend, duration, this.WOODWELL_COLORS.blue, this.WOODWELL_COLORS.red);
          });
          tempMeansChart.update();
        } else {
          //tempMeansChart.options.plugins.title.text = `Air Temperature`;
          tempMeansChart.data.datasets = [];
          tempMeansChart.update();
        }
      });

      this.addEventListener('frozen-days-trends-change', ({detail: {frozenDaysTrends}}) => {
        let duration = this.getDuration();
        if (frozenDaysTrends) {
          //frozenDaysChart.options.plugins.title.text = `Days with Frozen Ground - ${ duration } years`;
          frozenDaysChart.data.datasets = frozenDaysTrends.filter(frozenDaysTrend => {
            return (frozenDaysTrend.slope != null);
          }).map(frozenDaysTrend => {
            return createTrendDataset(frozenDaysTrend, duration, this.WOODWELL_COLORS.red, this.WOODWELL_COLORS.blue);
          });
          frozenDaysChart.update();
        } else {
          //frozenDaysChart.options.plugins.title.text = `Days with Frozen Ground`;
          frozenDaysChart.data.datasets = [];
          frozenDaysChart.update();
        }
      });

    });
  }

}

export default new Application();
