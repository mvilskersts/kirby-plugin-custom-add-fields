const PAGE_CREATE_DIALOG = {
  extends: 'k-page-create-dialog',
  template: `
    <k-dialog
      ref="dialog"
      :button="$t('page.draft.create')"
      :notification="notification"
      size="medium"
      theme="positive"
      @submit="$refs.form.submit()"
    >
      <k-form
        ref="form"
        :fields="fields"
        :novalidate="false"
        :key="template"
        v-model="page"
        @submit="submit"
        @input="input"
      />
    </k-dialog>
  `,
  data() {
    return {
      notification: null,
      parent: null,
      section: null,
      templates: [],
      template: '',
      page: {},
      addFields: {}
    };
  },

  computed: {
    fields() {
      var
        fields = {},
        field = {},
        endpoint = this.$route.path,
        section = 'addFields';

      if(this.addFields) {
        fields = this.addFields;
      } else {
        fields = {
          title: {
            label: this.$t("title"),
            type: "text",
            required: true,
            icon: "title"
          },
          slug: {
            label: this.$t("slug"),
            type: "text",
            required: true,
            counter: false,
            icon: "url"
          }
        }
      }

      fields.template = {
        name: "template",
        label: this.$t("kirby-plugin-custom-add-fields.addBasedOnTemplate"),
        type: "select",
        disabled: this.templates.length === 1,
        required: true,
        icon: "code",
        empty: false,
        options: this.templates
      }

      Object.keys(fields).forEach(name => {
        field = fields[name];

        if (name != "title" && name != "template" && this.page[name] === undefined){
          if (field.default !== null && field.default !== undefined) {
            this.$set(this.page, name, this.$helper.clone(field.default));
          } else {
            this.$set(this.page, name, null);
          }
        }

        if (name === "title" && this.page[name] === "") {
          if (field.default !== null && field.default !== undefined) {
            this.$set(this.page, name, this.$helper.clone(field.default));
          } else {
            this.$set(this.page, name, "");
          }
        }

        field.section = section;
        field.endpoints = {
          field: endpoint + "/addfields/" + this.template + "/" + name,
          section: endpoint + "/addsections/" + this.template + "/" + section,
          model: endpoint
        };
      });

      return fields;
    }
  },

  methods: {
    open(parent, blueprintApi, section) {
      this.parent  = parent;
      this.section = section;

      this.$api
        .get(blueprintApi + '/add-fields', {section: section})
        .then(response => {
          if(response.skipDialog){
            this.submit(response);
            return;
          }
          this.templates = response.map(blueprint => {
            return {
              value: blueprint.name,
              text: blueprint.title,
              addFields: blueprint.addFields,
              options: blueprint.options
            };
          });

          if (this.templates[0]) {
            this.page.template = this.templates[0].value;
            this.template = this.templates[0].value;
            this.addFields = this.templates[0].addFields;
            this.options = this.templates[0].options;
          }

          this.$refs.dialog.open();
        })
        .catch(error => {
          this.$store.dispatch("notification/error", error);
        });
    },

    input() {
      if(this.page.template !== this.template){
        var
          oTemplate = {},
          template = this.page.template;

        this.template  = template;

        oTemplate = this.templates.find(function(tpl){
          return tpl.value === template;
        });
        this.addFields = oTemplate.addFields;
        this.options = oTemplate.options;
        this.$set(this.page, "template", template);
      }
    },

    isValid() {
      var
        form = this.$refs.form,
        errors = {},
        invalid = false;

      if(form) {
        errors = form.$refs.fields.errors;
        invalid = true;

        Object.keys(errors).some(field => {
          var error = errors[field];
          invalid = error.$pending || error.$invalid || error.$error;
          return invalid;
        });
        return !invalid;
      } else {
        return !invalid;
      }
    },

    submit(pageData) {
      if (this.isValid()){
        var data = {};
        var route = '';
        
        if(pageData.skipDialog){
          data = pageData.page;
        } else {
          data = {
            template: this.page.template,
            slug: this.page.slug || Date.now(),
            content: this.page
          };
        }

        delete data.content.addFields;
        delete data.content.template;
   
        this.addPage(data)
          .then(page => {
            if(this.options && this.options.redirectToNewPage) {
              route = this.$api.pages.link(page.id);
            } else {
              route = page.parent ? this.$api.pages.link(page.parent.id) : '/';
            }

            this.success({
              route: route,
              message: ":)",
              event: "page.create"
            });
            this.$router.go();
          })
          .catch(error => {
            this.$refs.dialog.error(error.message);
          });
      } else {
        this.$refs.dialog.error("Form is not valid");
      }
    },

    addPage(data) {
      var path = this.parent + "/children";
      var options = {
        method: "POST",
        body: JSON.stringify(data),
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "x-requested-with": "xmlhttprequest",
          "content-type": "application/json",
        }
      };
  
      if (this.$store.state.languages.current) {
        options.headers["x-language"] = this.$store.state.languages.current.code;
      }
  
      // add the csrf token to every request if it has been set
      options.headers["x-csrf"] = window.panel.csrf;
  
      var id = "";
    
      return fetch(this.$api.config.endpoint + "/" + path, options)
        .then(response => {
          id = response.headers.get('X-CUSTOM-ADD-DIALOG-REDIRECT');
          return response.text();
        })
        .then(text => {
          try {
            return JSON.parse(text);
          } catch (e) {
            throw new Error("The JSON response from the API could not be parsed. Please check your API connection.");
          }
        })
        .then(json => {
          if (json.status && json.status === "error") {
            throw json;
          }
  
          let response = json;
  
          if (json.data && json.type && json.type === "model") {
            response = json.data;
            if (id) {
              response.id = id;
            }
          }
  
          return response;
        })
        .catch(error => {
          throw error;
        });
    }
  }
};

panel.plugin("steirico/kirby-plugin-custom-add-fields", {
  components: {
    'k-page-create-dialog': PAGE_CREATE_DIALOG
  },
  use: [
    function(Vue) {
      const
        VUE_COMPONENTS = Vue.options.components;

      Object.keys(VUE_COMPONENTS).forEach(componentName => {
        const COMPONENT = {
          components: {
            'k-page-create-dialog': PAGE_CREATE_DIALOG
          },
          extends: VUE_COMPONENTS[componentName]
        };
        Vue.component(componentName, COMPONENT);
      });
    }
  ]
});
