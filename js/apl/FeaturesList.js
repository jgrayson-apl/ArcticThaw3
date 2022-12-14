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
/**
 *
 * FeaturesList
 *  - Element: apl-features-list
 *  - Description: A list of Features
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  7/12/2022 - 0.0.1 -
 * Modified:
 *
 */

class FeaturesList extends HTMLElement {

  static version = '0.0.1';

  /**
   * @type {HTMLTemplateElement}
   */
  static FEATURE_ITEM_TEMPLATE;
  static {
    FeaturesList.FEATURE_ITEM_TEMPLATE = document.createElement('template');
    FeaturesList.FEATURE_ITEM_TEMPLATE.innerHTML = `      
      <calcite-pick-list-item
        label=""
        description=""
        value="">        
        <calcite-action
          slot="actions-end"
          label=""
          scale="s"
          appearance="clear"
          icon="information">
        </calcite-action>
      </calcite-pick-list-item>
    `;
  }

  /**
   * @type {HTMLElement}
   */
  container;

  /**
   * @type {MapView|SceneView}
   */
  view;

  /**
   * @type {FeatureLayer}
   */
  featureLayer;

  /**
   * @type {Object}
   */
  queryParams;

  /**
   * @type {Map<number,Graphic>}
   */
  featuresByOID;

  /**
   * @type {Map<number,Geometry>}
   */
  geometryByOID;

  /**
   * @typedef {{description: string, label: string, value: string}} FeatureInfo
   */

  /**
   *
   * @callback FeatureInfoCallback
   * @param {Graphic} feature
   * @returns {FeatureInfo}
   */
  getFeatureInfo;

  /**
   *
   * @param {HTMLElement} container
   * @param {MapView|SceneView} view
   */
  constructor({container, view}) {
    super();

    this.container = container;
    this.view = view;

    this.featuresByOID = new Map();
    this.geometryByOID = new Map();

    this.queryParams = {
      where: '1=1',
      maxRecordCountFactor: 5,
      returnGeometry: false
    };

    const shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.innerHTML = `
      <style>
        :host {
            display: flex;            
            flex-shrink: 1;
            flex-grow: 1;
            flex-direction: column;
            justify-content: flex-start;            
            min-width: 0;
            min-height: 0;       
            height: 100%; 
            overflow: hidden;    
        }      
        
        :host calcite-pick-list {
          width: 100%;
          height: 100%; 
          overflow: auto;
        }      
        
      </style>      
      <calcite-pick-list filter-enabled selection-follows-focus loading></calcite-pick-list>           
    `;

    this.container?.append(this);

  }

  /**
   *
   */
  connectedCallback() {

    this.list = this.shadowRoot.querySelector('calcite-pick-list');

  }

  /**
   *
   * @param {FeatureLayer} featureLayer
   * @param {Object}queryParams
   * @param {FeatureInfoCallback} getFeatureInfoCallback
   */
  initialize({featureLayer, queryParams = {}, getFeatureInfoCallback}) {
    require(['esri/core/reactiveUtils'], (reactiveUtils) => {

      this.featureLayer = featureLayer;
      this.queryParams = {...this.queryParams, ...queryParams};
      this.getFeatureInfo = getFeatureInfoCallback;

      // FILTER PLACEHOLDER //
      this.list.setAttribute('filter-placeholder', `Find ${ this.featureLayer.title }...`);

      // CREATE FEATURES LIST //
      this.createFeaturesList();

      // VIEW SELECTION CHANGE //
      reactiveUtils.watch(() => this.view.popup.selectedFeature, selectedFeature => {
        if (selectedFeature?.layer.id === this.featureLayer.id) {
          const featureOID = selectedFeature.getObjectId();
          this.updateSelection({featureOID});
        } else {
          this.clearSelection();
        }
      });

    });
  }

  /**
   *
   */
  createFeaturesList() {

    const featuresQuery = this.featureLayer.createQuery();
    featuresQuery.set(this.queryParams);
    this.featureLayer.queryFeatures(featuresQuery).then(featuresFS => {

      // CREATE FEATURE LIST ITEMS //
      const featureListItems = featuresFS.features.map(feature => {
        this.featuresByOID.set(feature.getObjectId(), feature);
        return this._createFeatureListItem({feature});
      });

      // ADD FEATURE LIST ITEMS //
      this.list.replaceChildren(...featureListItems);
      this.list.toggleAttribute('loading', false);

      // LIST SELECTION CHANGE //
      this.list.addEventListener('calciteListChange', async (evt) => {
        if (evt.detail.size) {
          let [featureOID, selectedItem] = evt.detail.entries().next().value;

          // OID AS NUMBER //
          featureOID = Number(featureOID);

          const feature = this.featuresByOID.get(featureOID);
          this.view.popup.open({features: [feature]});

          const action = selectedItem.querySelector('calcite-action');
          action.toggleAttribute('loading', true);
          this._goToFeatureByOID(featureOID).then(() => {
            action.toggleAttribute('loading', false);
            this.dispatchEvent(new CustomEvent('item-selected', {detail: {feature: this.featuresByOID.get(featureOID)}}));
          }).catch(()=>{
            action.toggleAttribute('loading', false);
          });
        }
      });

      // ACTION NODES CLICK //
      this.list.querySelectorAll('calcite-action').forEach(actionNode => {
        actionNode.addEventListener('click', () => {
          const feature = this.featuresByOID.get(Number(actionNode.parentNode.value));
          this.dispatchEvent(new CustomEvent('item-action', {detail: {feature}}));
        });
      });

    }).catch(console.error);

  }

  /**
   *
   * @param {Graphic} feature
   * @returns {HTMLElement}
   * @private
   */
  _createFeatureListItem({feature}) {
    const templateContent = FeaturesList.FEATURE_ITEM_TEMPLATE.content.cloneNode(true);
    const featureListItem = templateContent.querySelector('calcite-pick-list-item');

    const {label, description, value} = this.getFeatureInfo(feature);

    featureListItem.setAttribute('label', label);
    featureListItem.setAttribute('description', description);
    featureListItem.setAttribute('value', value);

    return featureListItem;
  }

  /**
   *
   * @param {number} featureOID
   * @returns {Promise<Graphic>}
   * @private
   */
  _getFeatureGeometry(featureOID) {
    return new Promise((resolve, reject) => {

      let geometry = this.geometryByOID.get(featureOID);
      if (geometry) {
        resolve({geometry});
      } else {
        this.featureLayer.queryFeatures({
          returnGeometry: true,
          outFields: [],
          objectIds: [Number(featureOID)]
        }).then(fs => {
          if (fs.features.length) {
            geometry = fs.features[0].geometry;
            this.geometryByOID.set(featureOID, geometry);
            resolve({geometry});
          } else { reject(); }
        });
      }

    });
  }

  /**
   *
   * @param {number} featureOID
   * @private
   */
  _goToFeatureByOID(featureOID) {
    return new Promise((resolve, reject) => {
      this._getFeatureGeometry(featureOID).then(({geometry}) => {
        const goToTarget = (geometry.type === 'point') ? geometry : geometry.extent.clone().expand(1.5);
        const goToOptions = (geometry.type === 'point') ? {scale: 500000} : {};
        this.view.goTo({target: goToTarget, ...goToOptions}).then(resolve);
      }).catch(reject);
    });
  }

  /**
   *
   */
  clearSelection() {
    this.view.popup.close();
    this.list.getSelectedItems().then((selectedItems) => {
      selectedItems.forEach(item => { item.selected = false; });
    });
  }

  /**
   *
   * @param {number} featureOID
   */
  updateSelection({featureOID}) {
    if (featureOID) {
      const featureListItem = this.list.querySelector(`calcite-pick-list-item[value="${ featureOID }"]`);
      if (featureListItem) {
        featureListItem.scrollIntoView({block: 'center', behavior: 'smooth'});
        featureListItem.selected = true;
      }
    } else {
      this.clearSelection();
    }
  };

}

customElements.define("apl-features-list", FeaturesList);

export default FeaturesList;
