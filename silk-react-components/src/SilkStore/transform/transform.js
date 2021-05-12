// Low level representation of silks /transform API

import rxmq from 'ecc-messagebus';
import superagent from '@eccenca/superagent';

import _ from 'lodash';

const silkStore = rxmq.channel('silk.api');

// TODO: Implement those once needed
silkStore.subject('transform.task.put').subscribe();
silkStore.subject('transform.task.delete').subscribe();

silkStore
    .subject('transform.task.rules.get')
    .subscribe(({data, replySubject}) => {
        const {baseUrl, project, transformTask} = data;

        superagent
            .get(`${baseUrl}/transform/tasks/${project}/${transformTask}/rules`)
            .accept('application/json')
            .observe()
            .multicast(replySubject)
            .connect();
    });

// TODO: Implement once needed
silkStore.subject('transform.task.rules.put').subscribe();

// TODO: Implement once needed
silkStore.subject('transform.task.rule.get').subscribe();

silkStore
    .subject('transform.task.rule.generate')
    .subscribe(({data, replySubject}) => {
        const {
            correspondences,
            parentId,
            baseUrl,
            project,
            transformTask,
            uriPrefix
        } = data;
        const send = {
            correspondences
        };
        if (uriPrefix) {
            send.uriPrefix = uriPrefix;
        }
        superagent
            .post(
                `${baseUrl}/ontologyMatching/rulesGenerator/${project}/${transformTask}/rule/${parentId}`
            )
            .accept('application/json')
            .send(send)
            .observe()
            .multicast(replySubject)
            .connect();
    });

silkStore
    .subject('transform.task.rule.suggestions')
    .subscribe(({data, replySubject}) => {
        const {ruleId, targetClassUris, baseUrl, project, transformTask, matchFromDataset, nrCandidates, targetVocabularies } = data;

        const json = {
            projectName: project,
            transformTaskName: transformTask,
            datasetUriPrefix: '',
            targetClassUris,
            nrCandidates: nrCandidates || 1,
            addMetaData: true,
            dataTypePropertiesOnly: false,
            ruleId,
            matchFromDataset,
            targetVocabularies,
        };

        superagent
            .post(`${baseUrl}/ontologyMatching/matchVocabularyClassDataset`)
            .accept('application/json')
            .send(json)
            .observe()
            .multicast(replySubject)
            .connect();
    });

silkStore.subject('transform.task.get').subscribe(({data, replySubject}) => {
    const {baseUrl, project, transformTask} = data;

    superagent
        .get(`${baseUrl}/transform/tasks/${project}/${transformTask}`)
        .accept('application/json')
        .observe()
        .multicast(replySubject)
        .connect();
});

silkStore
    .subject('transform.task.rule.put')
    .subscribe(({data, replySubject}) => {
        const {baseUrl, project, transformTask, ruleId, payload} = data;

        superagent
            .put(
                `${baseUrl}/transform/tasks/${project}/${transformTask}/rule/${ruleId}`
            )
            .accept('application/json')
            .type('application/json')
            .send(payload)
            .observe()
            .multicast(replySubject)
            .connect();
    });

silkStore
    .subject('transform.task.rule.delete')
    .subscribe(({data, replySubject}) => {
        const {baseUrl, project, transformTask, ruleId} = data;

        superagent
            .del(
                `${baseUrl}/transform/tasks/${project}/${transformTask}/rule/${ruleId}`
            )
            .accept('application/json')
            .observe()
            .multicast(replySubject)
            .connect();
    });

silkStore
    .subject('transform.task.rule.peak')
    .subscribe(({data, replySubject}) => {
        const {baseUrl, project, transformTask, id} = data;

        superagent
            .post(
                `${baseUrl}/transform/tasks/${project}/${transformTask}/peak/${id}`
            )
            .accept('application/json')
            .observe()
            .multicast(replySubject)
            .connect();
    });

silkStore
    .subject('transform.task.rule.valueSourcePaths')
    .subscribe(({data, replySubject}) => {
        const {
            baseUrl,
            project,
            transformTask,
            ruleId,
            unusedOnly = false,
            usedOnly = false,
        } = data;

        superagent
            .get(
                `${baseUrl}/transform/tasks/${project}/${transformTask}/rule/${ruleId}/valueSourcePaths`
            )
            .query({
                unusedOnly,
                usedOnly,
            })
            .accept('application/json')
            .observe()
            .multicast(replySubject)
            .connect();
    });

silkStore
    .subject('transform.task.rule.child.peak')
    .subscribe(({data, replySubject}) => {
        const {baseUrl, project, transformTask, rule, id} = data;
        superagent
            .post(
                `${baseUrl}/transform/tasks/${project}/${transformTask}/peak/${id}/childRule`
            )
            .accept('application/json')
            .send({...rule})
            .observe()
            .multicast(replySubject)
            .connect();
    });

silkStore
    .subject('transform.task.rule.rules.append')
    .subscribe(({data, replySubject}) => {
        const {baseUrl, project, transformTask, ruleId, payload} = data;

        superagent
            .post(
                `${baseUrl}/transform/tasks/${project}/${transformTask}/rule/${ruleId}/rules`
            )
            .accept('application/json')
            .type('application/json')
            .send(payload)
            .observe()
            .multicast(replySubject)
            .connect();
    });

silkStore
    .subject('transform.task.rule.rules.reorder')
    .subscribe(({data, replySubject}) => {
        const {baseUrl, project, transformTask, id, childrenRules} = data;
        superagent
            .post(
                `${baseUrl}/transform/tasks/${project}/${transformTask}/rule/${id}/rules/reorder`
            )
            .accept('application/json')
            .send(childrenRules)
            .type('application/json')
            .observe()
            .multicast(replySubject)
            .connect();
    });

silkStore
    .subject('transform.task.rule.completions.sourcePaths')
    .subscribe(({data, replySubject}) => {
        const {
            baseUrl,
            project,
            transformTask,
            ruleId,
            term,
            maxResults = 30,
        } = data;

        superagent
            .get(
                `${baseUrl}/transform/tasks/${project}/${transformTask}/rule/${ruleId}/completions/sourcePaths`
            )
            .query({
                term,
                maxResults,
            })
            .accept('application/json')
            .type('application/json')
            .observe()
            .multicast(replySubject)
            .connect();
    });
silkStore
    .subject('transform.task.rule.completions.targetProperties')
    .subscribe(({data, replySubject}) => {
        const {
            baseUrl,
            project,
            transformTask,
            ruleId,
            term,
            maxResults = 30,
        } = data;

        superagent
            .get(
                `${baseUrl}/transform/tasks/${project}/${transformTask}/rule/${ruleId}/completions/targetProperties`
            )
            .query({
                term,
                maxResults,
            })
            .accept('application/json')
            .type('application/json')
            .observe()
            .multicast(replySubject)
            .connect();
    });
silkStore
    .subject('transform.task.rule.completions.targetTypes')
    .subscribe(({data, replySubject}) => {
        const {
            baseUrl,
            project,
            transformTask,
            ruleId,
            term,
            maxResults = 30,
        } = data;

        superagent
            .get(
                `${baseUrl}/transform/tasks/${project}/${transformTask}/rule/${ruleId}/completions/targetTypes`
            )
            .query({
                term,
                maxResults,
            })
            .accept('application/json')
            .type('application/json')
            .observe()
            .multicast(replySubject)
            .connect();
    });

silkStore
    .subject('transform.task.rule.completions.valueTypes')
    .subscribe(({data, replySubject}) => {
      const {
        baseUrl,
        project,
        transformTask,
        ruleId,
        term,
        maxResults = 30,
      } = data;

      superagent
          .get(
              `${baseUrl}/transform/tasks/${project}/${transformTask}/rule/${ruleId}/completions/valueTypes`
          )
          .query({
            term,
            maxResults,
          })
          .accept('application/json')
          .type('application/json')
          .observe()
          .multicast(replySubject)
          .connect();
    });

silkStore
    .subject('transform.task.targetVocabulary.type')
    .subscribe(({data, replySubject}) => {
        const {baseUrl, project, transformTask, uri} = data;

        superagent
            .get(
                `${baseUrl}/transform/tasks/${project}/${transformTask}/targetVocabulary/type`
            )
            .accept('application/json')
            .query({
                uri,
            })
            .observe()
            .multicast(replySubject)
            .connect();
    });

silkStore
    .subject('transform.task.targetVocabulary.property')
    .subscribe(({data, replySubject}) => {
        const {baseUrl, project, transformTask, uri} = data;

        superagent
            .get(
                `${baseUrl}/transform/tasks/${project}/${transformTask}/targetVocabulary/property`
            )
            .accept('application/json')
            .query({
                uri,
            })
            .observe()
            .multicast(replySubject)
            .connect();
    });

silkStore
    .subject('transform.task.targetVocabulary.typeOrProperty')
    .subscribe(({data, replySubject}) => {
        const {baseUrl, project, transformTask, uri} = data;

        superagent
            .get(
                `${baseUrl}/transform/tasks/${project}/${transformTask}/targetVocabulary/typeOrProperty`
            )
            .accept('application/json')
            .query({
                uri,
            })
            .observe()
            .multicast(replySubject)
            .connect();
    });

silkStore
    .subject('transform.task.rule.copy')
    .subscribe(({data, replySubject}) => {
        const { baseUrl, project, transformTask, appendTo, queryParameters } = data;
        superagent
            .post(
                `${baseUrl}/transform/tasks/${project}/${transformTask}/rule/${appendTo}/rules/copyFrom`
            )
            .accept('application/json')
            .send(queryParameters)
            .query(queryParameters)
            .type('application/json')
            .observe()
            .multicast(replySubject)
            .connect();
    });

silkStore
    .subject('transform.task.rule.example')
    .subscribe(({data, replySubject}) => {
        const {baseUrl, project, transformTask, ruleId} = data;
        const ruleIdQuery = ruleId ? `?ruleId=${encodeURIComponent(ruleId)}` : ""
        superagent
            .get(
                `${baseUrl}/profiling/schemaClass/${project}/${transformTask}/ruleExampleValues${ruleIdQuery}`
            )
            .accept('application/json')
            .observe()
            .multicast(replySubject)
            .connect();
    });

silkStore
    .subject('transform.task.prefixes')
    .subscribe(({data, replySubject}) => {
        const {baseUrl, project} = data;
        
        superagent
            .get(
                `${baseUrl}/api/workspace/projects/${project}/prefixes`
            )
            .accept('application/json')
            .observe()
            .multicast(replySubject)
            .connect();
    });
