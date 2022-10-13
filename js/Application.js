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

          // VIEW SCALEBAR //
          const scalebarMinScale = this.scalebarMinScale;
          const scaleFormatter = new Intl.NumberFormat('default', {minimumFractionDigits: 0, maximumFractionDigits: 0});
          const scalebarNode = document.createElement('div');
          scalebarNode.classList.add('esri-widget', 'scalebar-node');
          reactiveUtils.watch(() => view.scale, (scale) => {
            scalebarNode.innerHTML = `1 : ${ scaleFormatter.format(scale) }`;
            scalebarNode.toggleAttribute('hidden', (scale > scalebarMinScale));
          });
          view.ui.add(scalebarNode, 'bottom-left');

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

        if (this.performanceInfo) {
          this.displayPerformanceInfo({view});
        }

        this.initializeTrendCharts();
        //this.initializeCountriesLayer({view});
        this.initializeNorthPole({view});
        //this.initializeArcticBorealZone({view});
        this.initializeTrendLayers({view}).then(({tempMeansTrendsLayer, frozenDaysTrendLayer}) => {
          this.initializeRendererUpdates({view, tempMeansTrendsLayer, frozenDaysTrendLayer});
          this.initializeTrendOptions({view, tempMeansTrendsLayer, frozenDaysTrendLayer});
          this.initializeAnalysisLocation({view, tempMeansTrendsLayer, frozenDaysTrendLayer});
          this.initializeViewSlides({view}).then(() => {
            this.initiatePlaceSearch().then(resolve).catch(reject);
          }).catch(reject);
        }).catch(reject);
      }).catch(reject);
    });
  }

  /**
   *
   * @param view
   */
  displayPerformanceInfo({view}) {

    const performanceAction = document.getElementById('performance-action');
    performanceAction.toggleAttribute('hidden', false);

    const updatePerformanceInfo = () => {
      const performanceInfo = view.performanceInfo;
      updateMemoryTitle(
        performanceInfo.usedMemory,
        performanceInfo.totalMemory,
        performanceInfo.quality
      );
      updateTables(performanceInfo);
      setTimeout(updatePerformanceInfo, 1000);
    };

    const title = document.getElementById("performance-title");

    function updateMemoryTitle(used, total, quality) {
      title.innerHTML = `Memory: ${ getMB(used) }MB/${ getMB(total) }MB  -  Quality: ${ Math.round(100 * quality) } %`;
    }

    const tableMemoryContainer = document.getElementById("performance-memory");
    const tableCountContainer = document.getElementById("performance-count");

    function updateTables(stats) {
      tableMemoryContainer.innerHTML = `<tr><th>Resource</th><th>Memory(MB)</th></tr>`;

      for (const layerInfo of stats.layerPerformanceInfos) {
        const row = document.createElement("tr");
        row.innerHTML = `<td>${ layerInfo.layer.title }</td><td class="center">${ getMB(layerInfo.memory) }</td>`;
        tableMemoryContainer.appendChild(row);
      }

      tableCountContainer.innerHTML = `<tr>
            <th>Layer - Features</th>
            <th>Displayed / Max<br>(count)</th>
            <th>Total<br>(count)</th>
          </tr>`;

      for (const layerInfo of stats.layerPerformanceInfos) {
        if (layerInfo.maximumNumberOfFeatures) {
          const row = document.createElement("tr");
          row.innerHTML = `<td>${ layerInfo.layer.title }`;
          row.innerHTML += `<td class="center">${
            layerInfo.displayedNumberOfFeatures
              ? layerInfo.displayedNumberOfFeatures
              : "-"
          } / ${
            layerInfo.maximumNumberOfFeatures
              ? layerInfo.maximumNumberOfFeatures
              : "-"
          }</td>`;
          row.innerHTML += `<td class="center">${
            layerInfo.totalNumberOfFeatures
              ? layerInfo.totalNumberOfFeatures
              : "-"
          }</td>`;
          tableCountContainer.appendChild(row);
        }
      }
    }

    function getMB(bytes) {
      const kilobyte = 1024;
      const megabyte = kilobyte * 1024;
      return Math.round(bytes / megabyte);
    }

    view.when(() => {
      updatePerformanceInfo();
    });

  }

  /**
   *
   * @param view
   */
  initializeViewSlides({view}) {
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
          //slidesList.goToSlide('North Pole', {duration: 5000}).then(resolve).catch(reject);
          resolve();
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
          //color: 'rgba(204,234,251,0.85)',
          color: 'rgba(130,130,130,0.85)',
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
      ]).then(() => {

        // ENABLE ABILITY TO SAVE THE WEB SCENE //
        if (this.saveMap === 'true') {
          const rendererAction = document.getElementById('renderer-action');
          rendererAction.toggleAttribute('hidden', false);
          const mapSaveAction = document.getElementById('map-save-action');
          mapSaveAction.toggleAttribute('hidden', false);
          mapSaveAction.addEventListener('click', () => {
            // SAVE WEB SCENE //
            if (confirm("Are you sure you want to update and save the Web Scene?")) {
              view.map.updateFrom(view, {environmentExcluded: true}).then(() => {
                view.map.save({ignoreUnsupported: true});
              }).catch(error => {
                this.displayError(error);
              });
            }
          });
        }

        resolve({tempMeansTrendsLayer, frozenDaysTrendLayer});
      }).catch(reject);
    });

  }

  /**
   *
   * @param view
   * @param tempMeansTrendsLayer
   * @param frozenDaysTrendLayer
   */
  initializeRendererUpdates({view, tempMeansTrendsLayer, frozenDaysTrendLayer}) {

    // UPDATE TREND LAYERS AND SAVE RENDERING IN WEB SCENE //
    const _updateTrendLayerRendering = ({tempMeansMinMax, frozenDaysMinMax}) => {

      const defaultSettings = {
        bandIds: [0],
        interpolation: 'bilinear',
        blendMode: 'multiply',
        opacity: 1.0,
        renderingRule: null
      };

      tempMeansTrendsLayer.set({
        ...defaultSettings,
        renderer: {
          type: 'raster-stretch',
          stretchType: 'min-max',
          statistics: [{
            min: -tempMeansMinMax,
            max: tempMeansMinMax,
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
        ...defaultSettings,
        renderer: {
          type: 'raster-stretch',
          stretchType: 'min-max',
          statistics: [{
            min: -frozenDaysMinMax,
            max: frozenDaysMinMax,
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

    };

    const tempMeansRenderer = document.getElementById('temp-means-renderer');
    tempMeansRenderer.value = 0.08;
    tempMeansRenderer.addEventListener('calciteSliderInput', () => {
      _updateTrendLayerRendering({
        tempMeansMinMax: tempMeansRenderer.value,
        frozenDaysMinMax: frozenDaysRenderer.value
      });
    });
    const frozenDaysRenderer = document.getElementById('frozen-days-renderer');
    frozenDaysRenderer.value = 0.80;
    frozenDaysRenderer.addEventListener('calciteSliderInput', () => {
      _updateTrendLayerRendering({
        tempMeansMinMax: tempMeansRenderer.value,
        frozenDaysMinMax: frozenDaysRenderer.value
      });
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
          abzLabel.innerHTML = abzTrend ? `${ degreeFormatter.format(abzTrend) }` : '--'; //&deg;
          locationLabel.innerHTML = locationTrend ? `${ degreeFormatter.format(locationTrend) }` : '--';
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

        const abzTrend = getDataResults ? arcticBorealZoneTrends[indicator][getDataResults.duration] : null;
        const locationTrend = (getDataResults?.slope * 10);

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
      view.container.style.cursor = 'pointer';
      view.on('click', this.setAnalysisLocation);

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
          return view.goTo({...goToParams.target, scale: view.scale}, {duration: 5000});
        }
      });
      search.on('select-result', ({result: {feature}}) => {
        this.setAnalysisLocation({mapPoint: feature.geometry});
      });
      this.clearSearchTerm = () => {
        search.searchTerm = null;
      };

      // ALLOW OTHER PARTS OF THE APP TO INITIATE A PLACE SEARCH //
      // NOTE: CURRENTLY HAPPENS AFTER INITIAL ANIMATION //
      this.initiatePlaceSearch = () => {
        return new Promise((resolve, reject) => {
          if (search.searchTerm) {
            search.search(search.searchTerm).then(resolve).catch(reject);
          } else { resolve(); }
        });
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

      const defaultABZDataset = {
        type: 'line',
        label: 'Arctic-Boreal Zone',
        fill: false,
        borderColor: 'rgb(180,240,60)',
        borderWidth: 1.8,
        borderDash: [10, 5],
        tension: 0.1
      };

      const abzDatasets = {
        'temp-means': {
          ...defaultABZDataset,
          data: this.arcticThaw.arcticBorealZoneData['temp-means']
        },
        'frozen-days': {
          ...defaultABZDataset,
          data: this.arcticThaw.arcticBorealZoneData['frozen-days']
        }
      };

      const defaultTitle = {
        display: true,
        color: '#efefef',
        font: {weight: 'normal', size: 15}
      };

      const defaultLegend = {
        display: true,
        onClick: null,
        labels: {
          pointStyle: 'line',
          usePointStyle: true,
          color: '#efefef',
          generateLabels: (chart) => {
            return Chart.defaults.plugins.legend.labels.generateLabels(chart).map(item => {
              return (item.datasetIndex === 0) ? item : {
                text: item.text,
                pointStyle: 'rect',
                strokeStyle: '#fefefe'
              };
            });
          }
        }
      };

      const defaultGridLines = {
        color: '#666666',
        drawBorder: true
      };

      const defaultDataset = {
        label: 'Analysis Location',
        type: 'bar',
        barThickness: 'flex'
      };

      const tempMeansTrendChartNode = document.getElementById('temp-means-trend-chart');
      const tempMeansChart = new Chart(tempMeansTrendChartNode, {
        data: {
          datasets: [abzDatasets['temp-means']]
        },
        options: {
          animations: false,
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: 10
          },
          plugins: {
            title: {
              ...defaultTitle,
              text: 'Air Temperature Trends'
            },
            legend: defaultLegend
          },
          scales: {
            y: {
              type: 'linear',
              display: true,
              title: {
                display: true,
                text: '°C per Decade',
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
              type: 'category',
              offset: true,
              labels: ["60 yrs", "50 yrs", "40 yrs", "30 yrs", "20 yrs"],
              position: 'bottom',
              title: {
                display: true,
                text: 'Trend Duration',
                color: '#efefef',
                font: {size: 12}
              },
              ticks: {
                padding: 5,
                color: '#efefef',
                font: {size: 11}
              },
              grid: defaultGridLines
            }
          }
        }
      });

      const frozenDaysTrendChartNode = document.getElementById('frozen-days-trend-chart');
      const frozenDaysChart = new Chart(frozenDaysTrendChartNode, {
        data: {
          datasets: [abzDatasets['frozen-days']]
        },
        options: {
          animations: false,
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: 10
          },
          plugins: {
            title: {
              ...defaultTitle,
              text: 'Days with Frozen Ground Trends'
            },
            legend: defaultLegend
          },
          scales: {
            y: {
              type: 'linear',
              display: true,
              title: {
                display: true,
                text: 'Days per Decade',
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
              type: 'category',
              offset: true,
              labels: ["60 yrs", "50 yrs", "40 yrs", "30 yrs", "20 yrs"],
              position: 'bottom',
              title: {
                display: true,
                text: 'Trend Duration',
                color: '#efefef',
                font: {size: 12}
              },
              ticks: {
                padding: 5,
                color: '#efefef',
                font: {size: 11}
              },
              grid: defaultGridLines
            }
          }
        }
      });

      /**
       *
       *
       * @param trendInfos
       * @param duration
       * @param decreaseColor
       * @param increaseColor
       * @param _data
       * @returns {*}
       */
      const createTrendDataset = (trendInfos, duration, decreaseColor, increaseColor, _data) => {
        return trendInfos.reduce((infos, trendInfo) => {
          if (trendInfo.slope != null) {

            const isCurrentDuration = (trendInfo.duration === duration);
            const borderWidth = isCurrentDuration ? 2.2 : 1.2;

            const trendColor = new Color((trendInfo.slope < 0.0) ? decreaseColor : increaseColor);
            const borderColor = new Color(isCurrentDuration ? '#fefefe' : trendColor);
            const backgroundColor = trendColor.clone();
            backgroundColor.a = isCurrentDuration ? 1.0 : 0.4;

            infos.borderWidth.push(borderWidth);
            infos.borderColor.push(borderColor.toCss(true));
            infos.backgroundColor.push(backgroundColor.toCss(true));
            infos.data.push(trendInfo.slope * 10.0);
          }
          return infos;
        }, {
          borderColor: [..._data],
          backgroundColor: [..._data],
          borderWidth: [..._data],
          data: [..._data]
        });

      };

      this.addEventListener('temp-means-trends-change', ({detail: {tempMeansTrends}}) => {
        if (tempMeansTrends) {
          let duration = this.getDuration();
          const dataset = createTrendDataset(tempMeansTrends, duration, this.WOODWELL_COLORS.blue, this.WOODWELL_COLORS.red, []);
          tempMeansChart.data.datasets[1] = {...defaultDataset, ...dataset};
        } else {
          tempMeansChart.data.datasets[1] = null;
        }
        tempMeansChart.update();
      });

      this.addEventListener('frozen-days-trends-change', ({detail: {frozenDaysTrends}}) => {
        if (frozenDaysTrends) {
          let duration = this.getDuration();
          const dataset = createTrendDataset(frozenDaysTrends, duration, this.WOODWELL_COLORS.red, this.WOODWELL_COLORS.blue, [null, null]);
          frozenDaysChart.data.datasets[1] = {...defaultDataset, ...dataset};
        } else {
          frozenDaysChart.data.datasets[1] = null;
        }
        frozenDaysChart.update();
      });

    });
  }

}

export default new Application();
