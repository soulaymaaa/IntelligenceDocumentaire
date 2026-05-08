# Diagramme de cas d'utilisation global - DocIntel

Cette version est adaptee pour un rapport PFE : elle garde un seul acteur principal
et presente les grandes fonctionnalites de la plateforme sans surcharger le schema.

## Version PlantUML recommandee

```plantuml
@startuml
left to right direction
skinparam shadowing false
skinparam usecase {
  BackgroundColor white
  BorderColor black
  ArrowColor black
}

actor "Utilisateur" as User

rectangle "DocIntel" {
  usecase "S'inscrire" as UC_Register
  usecase "S'authentifier" as UC_Login
  usecase "Reinitialiser\nmot de passe" as UC_Reset
  usecase "Gerer profil" as UC_Profile

  usecase "Importer document" as UC_Upload
  usecase "Consulter documents" as UC_ViewDocs
  usecase "Gerer cycle de vie\ndes documents" as UC_Lifecycle
  usecase "Archiver document" as UC_Archive
  usecase "Restaurer document" as UC_Restore
  usecase "Traiter document\nOCR et indexation" as UC_Process

  usecase "Recherche semantique" as UC_Search
  usecase "Generer resume" as UC_Summary
  usecase "Questionner documents" as UC_Ask
  usecase "Consulter sources\net extraits" as UC_Sources
  usecase "Gerer conversations" as UC_Conversations

  usecase "Consulter tableau\nde bord" as UC_Dashboard
  usecase "Suivre etat\ndes documents" as UC_Status
}

User --> UC_Register
User --> UC_Login
User --> UC_Reset
User --> UC_Profile
User --> UC_Upload
User --> UC_ViewDocs
User --> UC_Lifecycle
User --> UC_Search
User --> UC_Summary
User --> UC_Ask
User --> UC_Conversations
User --> UC_Dashboard

UC_Upload ..> UC_Process : <<include>>
UC_Lifecycle ..> UC_Archive : <<include>>
UC_Lifecycle ..> UC_Restore : <<include>>

UC_Ask ..> UC_Search : <<include>>
UC_Ask ..> UC_Sources : <<include>>
UC_Conversations ..> UC_Ask : <<include>>

UC_Dashboard ..> UC_Status : <<include>>

UC_Register -[hidden]down- UC_Login
UC_Login -[hidden]down- UC_Reset
UC_Reset -[hidden]down- UC_Profile
UC_Profile -[hidden]down- UC_Upload
UC_Upload -[hidden]down- UC_ViewDocs
UC_ViewDocs -[hidden]down- UC_Lifecycle
UC_Lifecycle -[hidden]down- UC_Search
UC_Search -[hidden]down- UC_Summary
UC_Summary -[hidden]down- UC_Ask
UC_Ask -[hidden]down- UC_Conversations
UC_Conversations -[hidden]down- UC_Dashboard

UC_Upload -[hidden]right- UC_Process
UC_Lifecycle -[hidden]right- UC_Archive
UC_Archive -[hidden]down- UC_Restore
UC_Ask -[hidden]right- UC_Sources
UC_Dashboard -[hidden]right- UC_Status

@enduml
```

## Version Mermaid

```mermaid
flowchart LR
  User([Utilisateur])

  subgraph System[DocIntel]
    UC_Register((S'inscrire))
    UC_Login((S'authentifier))
    UC_Reset((Reinitialiser mot de passe))
    UC_Profile((Gerer profil))

    UC_Upload((Importer document))
    UC_ViewDocs((Consulter documents))
    UC_Lifecycle((Gerer cycle de vie des documents))
    UC_Archive((Archiver document))
    UC_Restore((Restaurer document))
    UC_Process((Traiter document OCR et indexation))

    UC_Search((Recherche semantique))
    UC_Summary((Generer resume))

    UC_Ask((Questionner documents))
    UC_Sources((Consulter sources et extraits))
    UC_Conversations((Gerer conversations))

    UC_Dashboard((Consulter tableau de bord))
    UC_Status((Suivre etat documents))
  end

  User --> UC_Register
  User --> UC_Login
  User --> UC_Reset
  User --> UC_Profile
  User --> UC_Upload
  User --> UC_ViewDocs
  User --> UC_Lifecycle
  User --> UC_Search
  User --> UC_Summary
  User --> UC_Ask
  User --> UC_Conversations
  User --> UC_Dashboard

  UC_Upload -. inclut .-> UC_Process
  UC_Lifecycle -. inclut .-> UC_Archive
  UC_Lifecycle -. inclut .-> UC_Restore

  UC_Ask -. inclut .-> UC_Search
  UC_Ask -. inclut .-> UC_Sources
  UC_Conversations -. inclut .-> UC_Ask

  UC_Dashboard -. inclut .-> UC_Status
```

## Description courte pour le rapport

Le diagramme de cas d'utilisation global presente les principales interactions entre
l'utilisateur et la plateforme DocIntel. L'utilisateur peut acceder au systeme,
gerer son profil, importer et consulter ses documents, lancer leur traitement,
gerer leur cycle de vie en les archivant ou en les restaurant, effectuer des
recherches semantiques, generer des resumes, poser des questions aux documents
et suivre l'etat general depuis le tableau de bord.
